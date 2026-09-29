import {CallOptions, InvocationType, RpcContext, RpcError, RpcErrors, Services} from "../rpc.js"
import {HttpClient} from "./HttpClient.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import {createRemote, ServicesClient} from "./remote.js"
import {ConsumeServicesOptions, RpcClient} from "./index.js"
import {withMiddlewares} from "../utils/middleware.js"

export class RpcClientImpl<S extends Services<S>> implements RpcClient {
  constructor(
    url: string,
    private readonly options: ConsumeServicesOptions,
  ) {
    const concurrency = options.resubscribeConcurrency ?? Infinity
    if (concurrency !== Infinity && (!Number.isInteger(concurrency) || concurrency < 1)) {
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
    const deadline = callOptions?.timeout == null ? undefined : Date.now() + callOptions.timeout

    // Start connecting, if not already
    void this.connection.connect()

    this.snapshotsInFlight++
    try {
      const data = await this.invoke(
        itemName,
        InvocationType.Subscribe,
        (...parameters) =>
          this.httpClient.subscribe(
            itemName,
            parameters,
            callOptions?.timeout ?? this.options.callTimeout,
          ),
        parameters,
      ).finally(() => {
        // Count transport work, not a caller waiting for a newer generation.
        this.snapshotsInFlight--
        this.drainResubscriptions()
      })

      if (!request.isCurrent()) {
        await this.waitForCurrentSnapshot(request, deadline)
        return
      }
      this.remoteSubscriptions.unpause(itemName, parameters)

      this.remoteSubscriptions.consume(itemName, parameters, data)
      this.remoteSubscriptions.flushQueue(itemName, parameters)
    } catch (e) {
      if (!request.isCurrent()) {
        // A caller's explicit deadline still applies until a replacement delivers data.
        if (
          callOptions?.timeout != null &&
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
    const noSubscriptionsLeft = this.remoteSubscriptions.unsubscribe(itemName, parameters, consumer)

    if (noSubscriptionsLeft) {
      await this.invoke(
        itemName,
        InvocationType.Unsubscribe,
        (...parameters) =>
          this.httpClient.unsubscribe(
            itemName,
            parameters,
            callOptions?.timeout ?? this.options.callTimeout,
          ),
        parameters,
      )
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
      .getAllSubscriptions()
      .map(([itemName, params]) => ({
        itemName,
        params,
        request: this.remoteSubscriptions.beginRequest(itemName, params),
      }))
    for (const task of previous) task.request.finish()
    this.drainResubscriptions()
  }

  private drainResubscriptions() {
    const limit = this.options.resubscribeConcurrency ?? Infinity
    while (!this.closed && this.snapshotsInFlight < limit && this.resubscribeQueue.length) {
      const task = this.resubscribeQueue.shift()!
      // A later wave, unsubscribe, or a new initial request superseded this work.
      if (!task.request.isCurrent()) {
        task.request.finish()
        continue
      }
      void this.restoreSubscription(task)
    }
  }

  private async restoreSubscription({itemName, params, request}: Resubscription) {
    this.snapshotsInFlight++
    try {
      const data = await this.httpClient.subscribe(itemName, params, this.options.callTimeout)
      if (!request.isCurrent()) return
      this.remoteSubscriptions.unpause(itemName, params)
      this.remoteSubscriptions.consume(itemName, params, data)
      this.remoteSubscriptions.flushQueue(itemName, params)
    } catch (error) {
      if (!request.isCurrent()) return
      request.finish(error)
      this.remoteSubscriptions.unpause(itemName, params)
      this.remoteSubscriptions.flushQueue(itemName, params)
      // Keep the consumers for the next recovery attempt.
    } finally {
      request.finish()
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
