import {Services} from "../rpc.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {HttpClient} from "./HttpClient.js"
import {createRemote, ServicesWithSubscriptions} from "./remote.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"
import WebSocket from "ws"

export type RpcClient = {
  isConnected(): boolean
  close(): Promise<void>

  // test-only
  _subscriptions(): Map<any, any>
  _webSocket(): WebSocket | null
}

export type ConsumeServicesOptions = {
  callTimeout: number
  subscribe: boolean
  reconnectDelay: number
  errorDelayMaxDuration: number
  pingInterval: number
}

export async function consumeServices<S extends Services>(
  url: string,
  overrideOptions: Partial<ConsumeServicesOptions> = {}
): Promise<{
  client: RpcClient
  remote: ServicesWithSubscriptions<S>
}> {
  if (url.endsWith("/")) {
    throw new Error("URL must not end with /")
  }

  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const client = new RpcClientImpl<S>(url, options)

  return {
    client,
    remote: client.createRemote(),
  }
}

class RpcClientImpl<S extends Services> implements RpcClient {
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

  _subscriptions() {
    return this.remoteSubscriptions._subscriptions()
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
    this.remoteSubscriptions.unsubscribe(itemName, parameters, consumer)

    await this.httpClient.unsubscribe(itemName, parameters)
  }

  private resubscribe = () => {
    /*
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

     */
  }
}

const defaultOptions: ConsumeServicesOptions = {
  callTimeout: 5 * 1000,
  subscribe: true,
  reconnectDelay: 0,
  errorDelayMaxDuration: 15 * 1000,
  pingInterval: 30 * 1000, // should be in-sync with server
}
