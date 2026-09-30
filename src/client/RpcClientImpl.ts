import {
  CallOptions,
  InvocationType,
  RpcContext,
  RpcError,
  RpcErrors,
  Services,
  SubscriptionOwnership,
} from "../rpc.js"
import {HttpClient, UnsupportedSubscriptionProtocol} from "./HttpClient.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import {createRemote, ServicesClient} from "./remote.js"
import {ConsumeServicesOptions, RpcClient} from "./index.js"
import {withDeadline} from "../utils/promises.js"
import {withMiddlewares} from "../utils/middleware.js"

export class RpcClientImpl<S extends Services<S>> implements RpcClient {
  constructor(
    url: string,
    private readonly options: ConsumeServicesOptions,
  ) {
    if (options.subscriptionLifetimes && !options.subscriptions) {
      throw new Error("subscriptionLifetimes requires subscriptions")
    }
    this.resubscribeConcurrency = options.resubscribeConcurrency ?? Infinity
    if (
      this.resubscribeConcurrency !== Infinity &&
      (!Number.isInteger(this.resubscribeConcurrency) || this.resubscribeConcurrency < 1)
    ) {
      throw new Error("resubscribeConcurrency must be a positive integer or Infinity")
    }
    this.httpClient = new HttpClient(url, this.clientId, options.getHeaders)
    this.remoteSubscriptions = new RemoteSubscriptions(options.cache)

    this.connection = new WebSocketConnection(
      options.getSubscriptionsUrl(url),
      this.clientId,
      {
        subscriptions: options.subscriptions,
        errorDelayMaxDuration: options.errorDelayMaxDuration,
        reconnectDelay: options.reconnectDelay,
        pingInterval: options.pingInterval,
        reconnectPolicy: options.reconnectPolicy,
        subscriptionLifetimes: options.subscriptionLifetimes,
      },
      (itemName, parameters, data) => {
        const ctx: RpcContext = {
          clientId: this.clientId,
          itemName,
          invocationType: InvocationType.Update,
        }

        const next = async (nextData = data, nextParameters = parameters) =>
          this.remoteSubscriptions.consume(itemName, nextParameters, nextData)

        return withMiddlewares(
          ctx,
          this.options.notificationsMiddleware,
          next as any,
          data,
          parameters,
        )
      },
      () => {
        this.resubscribe()
        options.onConnected()
      },
      () => {
        options.onDisconnected()
      },
    )
  }

  public readonly clientId = nanoid()
  private readonly resubscribeConcurrency: number
  private readonly httpClient: HttpClient
  private readonly remoteSubscriptions: RemoteSubscriptions
  private readonly connection: WebSocketConnection

  isConnected() {
    return this.connection.isConnected()
  }

  close() {
    this.closed = true
    for (const task of this.resubscribeQueue) task.request.finish(new Error("Client closed"))
    this.resubscribeQueue = []
    return this.connection.close()
  }

  reconnect(options?: {immediate?: boolean}) {
    this.connection.reconnect(options)
  }

  _allSubscriptions() {
    const result: Array<
      [itemName: string, parameters: unknown[], consumers: (d: unknown) => void]
    > = []

    for (const [
      itemName,
      parameters,
      consumers,
    ] of this.remoteSubscriptions.getAllSubscriptions()) {
      for (const consumer of consumers) {
        result.push([itemName, parameters, consumer])
      }
    }
    return result
  }

  _webSocket() {
    return this.connection._webSocket()
  }

  createRemote(): ServicesClient<S> {
    return createRemote<S>({
      call: this.call,
      subscribe: this.subscribe,
      unsubscribe: this.unsubscribe,
    })
  }

  async connect() {
    await this.connection.connect()
  }

  private call = (
    itemName: string,
    parameters: unknown[],
    callOptions?: CallOptions,
  ): Promise<unknown> => {
    return this.invoke(
      itemName,
      InvocationType.Call,
      (...parameters) =>
        this.httpClient.call(
          itemName,
          parameters,
          callOptions?.timeout ?? this.options.callTimeout,
        ),
      parameters,
    )
  }

  private subscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions,
  ): Promise<void> => {
    const cached = this.remoteSubscriptions.getCached(itemName, parameters)

    if (cached !== undefined) {
      consumer(cached)
    }

    // Register before requesting data so unsubscribe and reconnect can find this consumer
    // while the initial HTTP snapshot is still pending.
    this.remoteSubscriptions.addSubscription(itemName, parameters, consumer)

    const request = this.remoteSubscriptions.beginRequest(itemName, parameters)
    const timeout = callOptions?.timeout ?? this.options.callTimeout
    const deadline =
      this.options.subscriptionLifetimes || callOptions?.timeout != null
        ? Date.now() + timeout
        : undefined

    // Start connecting, if not already
    void this.connection.connect()

    try {
      // The slot covers transport work only, not a caller waiting for a newer generation.
      const data = await this.withSnapshotSlot(() =>
        this.requestSnapshot(itemName, parameters, request, timeout, deadline),
      )

      // deliver() re-checks ownership itself, so the snapshot is never applied to a
      // registration this request no longer owns.
      if (!request.deliver(data)) {
        await this.waitForCurrentSnapshot(request, deadline)
        return
      }
    } catch (e) {
      if (e instanceof UnsupportedSubscriptionProtocol) void this.close()
      if (!request.isCurrent()) {
        // A caller's explicit deadline still applies until a replacement delivers data.
        if (
          deadline !== undefined &&
          (e as {code?: number}).code === RpcErrors.Timeout &&
          request.hasPendingSnapshot()
        ) {
          throw e
        }
        await this.waitForCurrentSnapshot(request, deadline)
        return
      }
      this.remoteSubscriptions.unpause(itemName, parameters)
      this.remoteSubscriptions.emptyQueue(itemName, parameters)

      // Keep consumers registered so the next connection can recover failed subscriptions.
      request.finish(e)
      throw e
    } finally {
      request.finish()
    }
  }

  private waitForCurrentSnapshot(request: SnapshotRequest, deadline: number | undefined) {
    if (deadline === undefined || !request.hasPendingSnapshot()) return request.wait()

    // The old HTTP request may have finished, but awaiting its replacement must
    // still respect the caller's original deadline.
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new RpcError(RpcErrors.Timeout, "Timeout")),
        Math.max(0, deadline - Date.now()),
      )
      void request
        .wait()
        .then(resolve, reject)
        .finally(() => clearTimeout(timer))
    })
  }

  private unsubscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions,
  ) => {
    // Capture before removal/awaits: an old PATCH must never adopt a replacement socket's epoch.
    const ownership = this.options.subscriptionLifetimes
      ? this.remoteSubscriptions.getOwnership(itemName, parameters)
      : undefined
    const noSubscriptionsLeft = this.remoteSubscriptions.unsubscribe(itemName, parameters, consumer)
    const timeout = callOptions?.timeout ?? this.options.callTimeout
    const deadline = Date.now() + timeout

    if (noSubscriptionsLeft && (!this.options.subscriptionLifetimes || ownership)) {
      try {
        const work = this.invoke(
          itemName,
          InvocationType.Unsubscribe,
          (...parameters) =>
            this.httpClient.unsubscribe(itemName, parameters, timeout, ownership, deadline),
          parameters,
        )
        if (ownership) await withDeadline(work, deadline)
        else await work
      } catch (error) {
        if (error instanceof UnsupportedSubscriptionProtocol) void this.close()
        throw error
      }
    }
  }

  private closed = false
  private snapshotsInFlight = 0
  private resubscribeQueue: Resubscription[] = []

  public resubscribe = () => {
    if (this.closed) return
    // Create every new generation before starting work: old in-flight replies
    // cannot win while the replacement snapshot is still waiting in the queue.
    const previous = this.resubscribeQueue
    this.resubscribeQueue = this.remoteSubscriptions
      .getSubscriptionKeys()
      .map(([itemName, params]) => ({
        itemName,
        params,
        request: this.remoteSubscriptions.beginRequest(itemName, params),
      }))
    for (const task of previous) task.request.finish()
    this.drainResubscriptions()
  }

  private drainResubscriptions() {
    while (
      !this.closed &&
      this.snapshotsInFlight < this.resubscribeConcurrency &&
      this.resubscribeQueue.length
    ) {
      const task = this.resubscribeQueue.shift()!
      // A later wave, unsubscribe, or a new initial request superseded this work.
      if (!task.request.isCurrent()) {
        task.request.finish()
        continue
      }
      void this.restoreSubscription(task)
    }
  }

  private restoreSubscription({itemName, params, request}: Resubscription) {
    return this.withSnapshotSlot(async () => {
      try {
        const data = await this.requestSnapshot(
          itemName,
          params,
          request,
          this.options.callTimeout,
          this.options.subscriptionLifetimes ? Date.now() + this.options.callTimeout : undefined,
          this.options.subscriptionLifetimes === true,
        )
        request.deliver(data)
      } catch (error) {
        if (error instanceof UnsupportedSubscriptionProtocol) void this.close()
        if (!request.isCurrent()) return
        request.finish(error)
        this.remoteSubscriptions.unpause(itemName, params)
        this.remoteSubscriptions.flushQueue(itemName, params)
        // Keep the consumers for the next recovery attempt.
      } finally {
        request.finish()
      }
    })
  }

  private async requestSnapshot(
    itemName: string,
    parameters: unknown[],
    request: SnapshotRequest,
    timeout: number,
    deadline?: number,
    useMiddleware = true,
  ) {
    let ownership: SubscriptionOwnership | undefined
    if (this.options.subscriptionLifetimes) {
      await withDeadline(this.connection.connect(), deadline!)
      if (!request.isCurrent()) return
      const epoch = this.connection.getConnectionEpoch()
      if (!epoch) throw new Error("Subscription connection is closed")
      ownership = request.bindConnection(epoch)
      if (!ownership) return
    }
    // Ownership is fixed before asynchronous middleware/headers; a late request
    // must never register itself on a replacement socket or another local lifetime.
    const send = (...nextParameters: unknown[]) => {
      if (ownership && !request.isCurrent()) return Promise.resolve(undefined)
      return this.httpClient.subscribe(
        itemName,
        nextParameters,
        timeout,
        ownership,
        deadline,
        ownership ? request.isCurrent : undefined,
      )
    }
    const work = useMiddleware
      ? this.invoke(itemName, InvocationType.Subscribe, send, parameters)
      : send(...parameters)
    return ownership ? withDeadline(work, deadline!) : work
  }

  /** Hold one recovery slot for the duration of the transport call, then let the queue advance. */
  private async withSnapshotSlot<T>(work: () => Promise<T>): Promise<T> {
    this.snapshotsInFlight++
    try {
      return await work()
    } finally {
      this.snapshotsInFlight--
      this.drainResubscriptions()
    }
  }

  private invoke(
    itemName: string,
    invocationType: InvocationType,
    next: (...params: unknown[]) => Promise<unknown>,
    parameters: unknown[],
  ) {
    const ctx: RpcContext = {
      clientId: this.clientId,
      itemName,
      invocationType: invocationType,
    }

    return withMiddlewares(ctx, this.options.middleware, next, ...parameters)
  }
}

type SnapshotRequest = ReturnType<RemoteSubscriptions["beginRequest"]>

type Resubscription = {
  itemName: string
  params: unknown[]
  request: SnapshotRequest
}
