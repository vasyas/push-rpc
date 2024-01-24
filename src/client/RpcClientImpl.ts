import {Services} from "../rpc.js"
import {HttpClient} from "./HttpClient.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import {ServicesWithSubscriptions, createRemote} from "./remote.js"
import {ConsumeServicesOptions, RpcClient} from "./index.js"

export class RpcClientImpl<S extends Services> implements RpcClient {
  constructor(
    url: string,
    private readonly options: ConsumeServicesOptions
  ) {
    const clientId = nanoid()

    this.httpClient = new HttpClient(url, clientId, {callTimeout: options.callTimeout})
    this.remoteSubscriptions = new RemoteSubscriptions()

    this.connection = new WebSocketConnection(
      url,
      clientId,
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
    return this.remoteSubscriptions.getAllSubscriptions()
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
    return this.httpClient.call(itemName, parameters)
  }

  private subscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ): Promise<void> => {
    const cached = this.remoteSubscriptions.getCached(itemName, parameters)

    if (cached !== undefined) {
      consumer(cached)
    }

    if (this.options.subscribe) {
      this.connection.connect().catch((e) => {
        // ignored
      })
    }

    const data = await this.httpClient.subscribe(itemName, parameters) // TODO callTimeout
    this.remoteSubscriptions.subscribe(data, itemName, parameters, consumer)
  }

  private unsubscribe = async (
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ) => {
    const noSubscriptionsLeft = this.remoteSubscriptions.unsubscribe(itemName, parameters, consumer)

    if (noSubscriptionsLeft) {
      await this.httpClient.unsubscribe(itemName, parameters)
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
}
