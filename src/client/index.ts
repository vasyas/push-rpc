import {Services} from "../rpc.js"
import {RemoteSubscriptions} from "./RemoteSubscriptions.js"
import {HttpClient} from "./HttpClient.js"
import {createRemote, ServicesWithSubscriptions} from "./remote.js"
import {WebSocketConnection} from "./WebSocketConnection.js"
import {nanoid} from "nanoid"

export type RpcClient = {
  close(): Promise<void>
}

export type ConsumeServicesOptions = {
  callTimeout: number
  subscribe: boolean
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
  const connection = new WebSocketConnection(url, clientId, (itemName, parameters, data) => {
    remoteSubscriptions.consume(itemName, parameters, data)
  })

  const remote = createRemote<S>({
    call(itemName: string, parameters: unknown[]): Promise<unknown> {
      // TODO callTimeout
      return client.call(itemName, parameters)
    },

    async subscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void): Promise<void> {
      // TODO consume cached data?

      if (options.subscribe) {
          connection.connect().catch(e => {
            // ignored
          })
      }

      const data = await client.subscribe(itemName, parameters) // TODO callTimeout
      remoteSubscriptions.subscribe(data, itemName, parameters, consumer)
    },

    async unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
      remoteSubscriptions.unsubscribe(itemName, parameters, consumer)

      await client.unsubscribe(itemName, parameters)
    }
  })
  return {
    client: {
      close() {
        return connection.close()
      }
    },
    remote,
  }
}

const defaultOptions: ConsumeServicesOptions = {
  callTimeout: 5 * 1000,
  subscribe: true,
}
