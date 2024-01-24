import {InvocationType, RpcContext, Services} from "../rpc.js"
import {HttpClient} from "./HttpClient.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import {createRemote, ServicesWithSubscriptions} from "./remote.js"
import {ConsumeServicesOptions, RpcClient} from "./index.js"
import {withMiddlewares} from "../utils/middleware.js"

export class RpcClientImpl<S extends Services> implements RpcClient {
  constructor(
    url: string,
    private readonly options: ConsumeServicesOptions
  ) {
    this.httpClient = new HttpClient(url, this.clientId, {callTimeout: options.callTimeout})
    this.remoteSubscriptions = new RemoteSubscriptions()

    this.connection = new WebSocketConnection(
      url,
      this.clientId,
      {
        errorDelayMaxDuration: options.errorDelayMaxDuration,
        reconnectDelay: options.reconnectDelay,
        pingInterval: options.pingInterval,
      },
      (itemName, parameters, data) => {
        this.remoteSubscriptions.consume(itemName, parameters, data)
      },
      this.resubscribe
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

  private call = (itemName: string, parameters: unknown[]): Promise<unknown> => {
    // TODO per-call callTimeout

    return this.invoke(
      itemName,
      InvocationType.Call,
      (...parameters) => this.httpClient.call(itemName, parameters),
      parameters
    )
  }

  private subscribe = async (
    remoteFunctionName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ): Promise<void> => {
    const cached = this.remoteSubscriptions.getCached(remoteFunctionName, parameters)

    if (cached !== undefined) {
      consumer(cached)
    }

    if (this.options.subscribe) {
      this.connection.connect().catch((e) => {
        // ignored
      })
    }

    // TODO callTimeout
    const data = await this.invoke(
      remoteFunctionName,
      InvocationType.Subscribe,
      (...parameters) => this.httpClient.subscribe(remoteFunctionName, parameters),
      parameters
    )
    this.remoteSubscriptions.subscribe(data, remoteFunctionName, parameters, consumer)
  }

  private unsubscribe = async (
    remoteFunctionName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ) => {
    const noSubscriptionsLeft = this.remoteSubscriptions.unsubscribe(
      remoteFunctionName,
      parameters,
      consumer
    )

    if (noSubscriptionsLeft) {
      await this.invoke(
        remoteFunctionName,
        InvocationType.Unsubscribe,
        (...parameters) => this.httpClient.unsubscribe(remoteFunctionName, parameters),
        parameters
      )
    }
  }

  private resubscribe = () => {
    for (const [itemName, params, consumers] of this.remoteSubscriptions.getAllSubscriptions()) {
      this.httpClient
        .subscribe(itemName, params)
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
    remoteFunctionName: string,
    invocationType: InvocationType,
    next: (...params: unknown[]) => Promise<unknown>,
    parameters: unknown[]
  ) {
    const ctx: RpcContext = {
      clientId: this.clientId,
      remoteFunctionName: remoteFunctionName,
      invocationType: invocationType,
    }

    return withMiddlewares(ctx, this.options.middleware, next, ...parameters)
  }
}
