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

  const clientId = nanoid()

  const client = new HttpClient(url, clientId, {callTimeout: options.callTimeout})
  const remoteSubscriptions = new RemoteSubscriptions()
  const connection = new WebSocketConnection(
    url,
    clientId,
    (itemName, parameters, data) => {
      remoteSubscriptions.consume(itemName, parameters, data)
    },
    {
      errorDelayMaxDuration: options.errorDelayMaxDuration,
      reconnectDelay: options.reconnectDelay,
      pingInterval: options.pingInterval,
    }
  )

  const remote = createRemote<S>({
    call(itemName: string, parameters: unknown[]): Promise<unknown> {
      // TODO per-call callTimeout
      return client.call(itemName, parameters)
    },

    async subscribe(
      itemName: string,
      parameters: unknown[],
      consumer: (d: unknown) => void
    ): Promise<void> {
      const cached = remoteSubscriptions.getCached(itemName, parameters)

      if (cached !== undefined) {
        consumer(cached)
      }

      if (options.subscribe) {
        connection.connect().catch((e) => {
          // ignored
        })
      }

      const data = await client.subscribe(itemName, parameters) // TODO callTimeout
      remoteSubscriptions.subscribe(data, itemName, parameters, consumer)
    },

    async unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
      remoteSubscriptions.unsubscribe(itemName, parameters, consumer)

      await client.unsubscribe(itemName, parameters)
    },
  })
  return {
    client: {
      close() {
        return connection.close()
      },
      isConnected() {
        return connection.isConnected()
      },

      _subscriptions: () => remoteSubscriptions._subscriptions(),
      _webSocket: () => connection._webSocket(),
    },
    remote,
  }
}

const defaultOptions: ConsumeServicesOptions = {
  callTimeout: 5 * 1000,
  subscribe: true,
  reconnectDelay: 0,
  errorDelayMaxDuration: 15 * 1000,
  pingInterval: 30 * 1000, // should be in-sync with server
}
