import {CallOptions, InvocationType, RpcContext, Services} from "../rpc.js"
import {HttpClient} from "./HttpClient.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import {createRemote, ServicesWithSubscriptions} from "./remote.js"
import {ConsumeServicesOptions, RpcClient} from "./index.js"
import {withMiddlewares} from "../utils/middleware.js"

export class RpcClientImpl<S extends Services<S>> implements RpcClient {
  constructor(
    url: string,
    private readonly options: ConsumeServicesOptions
  ) {
    this.httpClient = new HttpClient(url, this.clientId, options.getHeaders)
    this.remoteSubscriptions = new RemoteSubscriptions()

    this.connection = new WebSocketConnection(
      options.getSubscriptionsUrl(url),
      this.clientId,
      {
        subscriptions: options.subscriptions,
        errorDelayMaxDuration: options.errorDelayMaxDuration,
        reconnectDelay: options.reconnectDelay,
        pingInterval: options.pingInterval,
      },
      (itemName, parameters, data) => {
        this.remoteSubscriptions.consume(itemName, parameters, data)
      },
      () => {
        this.resubscribe()
        options.onConnected()
      },
      () => {
        options.onDisconnected()
      }
    )
  }

  private readonly clientId = nanoid()
  private readonly httpClient: HttpClient
  private readonly remoteSubscriptions: RemoteSubscriptions
  private readonly connection: WebSocketConnection

  isConnected() {
    return this.connection.isConnected()
  }

  close() {
    return this.connection.close()
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

  createRemote(): ServicesWithSubscriptions<S> {
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
    callOptions?: CallOptions
  ): Promise<unknown> => {
    return this.invoke(
      itemName,
      InvocationType.Call,
      (...parameters) =>
        this.httpClient.call(
          itemName,
          parameters,
          callOptions?.timeout ?? this.options.callTimeout
        ),
      parameters
    )
  }

  private subscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions
  ): Promise<void> => {
    const cached = this.remoteSubscriptions.getCached(itemName, parameters)

    if (cached !== undefined) {
      consumer(cached)
    }

    // Needs to be awaited b/c resubscribe will make a 2nd request then.
    // Also, server needs the connection to be established before making a subscription
    await this.connection.connect()

    try {
      this.remoteSubscriptions.addSubscription(itemName, parameters, consumer)

      const data = await this.invoke(
        itemName,
        InvocationType.Subscribe,
        (...parameters) =>
          this.httpClient.subscribe(
            itemName,
            parameters,
            callOptions?.timeout ?? this.options.callTimeout
          ),
        parameters
      )

      this.remoteSubscriptions.consume(itemName, parameters, data)
    } catch (e) {
      await this.unsubscribe(itemName, parameters, consumer)
      throw e
    }
  }

  private unsubscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions
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
            callOptions?.timeout ?? this.options.callTimeout
          ),
        parameters
      )
    }
  }

  private resubscribe = () => {
    for (const [itemName, params, consumers] of this.remoteSubscriptions.getAllSubscriptions()) {
      this.httpClient
        .subscribe(itemName, params, this.options.callTimeout)
        .then((data) => {
          this.remoteSubscriptions.consume(itemName, params, data)
        })
        .catch((e) => {
          for (const consumer of consumers) {
            this.remoteSubscriptions.unsubscribe(itemName, params, consumer)
          }
        })
    }
  }

  private invoke(
    itemName: string,
    invocationType: InvocationType,
    next: (...params: unknown[]) => Promise<unknown>,
    parameters: unknown[]
  ) {
    const ctx: RpcContext = {
      clientId: this.clientId,
      itemName,
      invocationType: invocationType,
    }

    return withMiddlewares(ctx, this.options.middleware, next, ...parameters)
  }
}
