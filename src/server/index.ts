import {RemoteFunction, RpcError, RpcErrors, Services} from "../rpc.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import {ServicesWithTriggers, withTriggers} from "./local.js"
import http from "http"
import {serveHttpRequest} from "./http.js"
import {Middleware, withMiddlewares} from "../utils/middleware.js"
import {log} from "../logger.js"
import {ConnectionsServer} from "./ConnectionsServer.js"
import {PromiseCache} from "../utils/promises.js"

export function publishServices<S extends Services>(
  services: S,
  overrideOptions: Partial<PublishServicesOptions> = {}
): Promise<{
  server: RpcServer
  services: ServicesWithTriggers<S>
}> {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const localSubscriptions = new LocalSubscriptions()

  const httpServer = http.createServer()

  const connectionsServer = new ConnectionsServer(
    httpServer,
    {pingInterval: options.pingInterval},
    (clientId) => {
      localSubscriptions.unsubscribeAll(clientId)
    }
  )

  const invocationCache = new PromiseCache()

  httpServer.addListener("request", (req, res) =>
    serveHttpRequest(req, res, options.path, {
      async call(clientId: string, itemName: string, parameters: unknown[]): Promise<unknown> {
        const item = getItem(services, itemName)

        if (!item) {
          throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
        }

        try {
          return await invokeItem(
            invocationCache,
            clientId,
            itemName,
            item,
            parameters,
            options.middleware
          )
        } catch (e) {
          log.error(`Cannot call item ${itemName}.`, e)
          throw e
        }
      },

      async subscribe(clientId: string, itemName: string, parameters: unknown[]) {
        const item = getItem(services, itemName)

        if (!item) {
          throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
        }

        try {
          const data = await invokeItem(
            invocationCache,
            clientId,
            itemName,
            item,
            parameters,
            options.middleware
          )

          localSubscriptions.subscribe(clientId, itemName, parameters, async () => {
            try {
              const data = await invokeItem(
                invocationCache,
                clientId,
                itemName,
                item,
                parameters,
                options.middleware
              )

              // TODO do not send if data is the same

              connectionsServer.publish(clientId, itemName, parameters, data)
            } catch (e) {
              log.error("Cannot get data for subscription", e)
            }
          })

          return data
        } catch (e) {
          log.error(`Failed to subscribe ${itemName}`, e)
          throw e
        }
      },

      async unsubscribe(clientId: string, itemName: string, parameters: unknown[]) {
        try {
          localSubscriptions.unsubscribe(clientId, itemName, parameters)
        } catch (e) {
          log.error(`Failed to unsubscribe ${itemName}`, e)
          throw e
        }
      },
    })
  )

  function closeHttpServer() {
    return new Promise<void>((resolve, reject) => {
      httpServer.closeIdleConnections()
      httpServer.close((err) => {
        if (err) reject(err)
        else resolve(err)
      })
    })
  }

  return new Promise((resolve, reject) => {
    httpServer.on("error", (err) => {
      reject(err)
    })

    httpServer.listen(options.port, options.host, () => {
      resolve({
        services: withTriggers(localSubscriptions, services),
        server: {
          async close() {
            await connectionsServer.close()
            await closeHttpServer()
          },

          _subscriptions() {
            return localSubscriptions._subscriptions()
          },
        },
      })
    })
  })
}

export type RpcServer = {
  close(): Promise<void>

  // test-only
  _subscriptions(): Map<any, any>
}

export type PublishServicesOptions = {
  port: number
  path: string
  host: string
  middleware: Middleware[]
  pingInterval: number
}

function getItem(
  root: any,
  itemName: string
): {function: RemoteFunction; container: any} | undefined {
  const parts = itemName.split("/")

  let item = root
  let parent

  for (const part of parts) {
    if (!item) return undefined

    parent = item
    item = item[part]
  }

  if (!item) return undefined

  return {
    function: item,
    container: parent,
  }
}

function invokeItem(
  invocationCache: PromiseCache,
  clientId: string,
  itemName: string,
  item: {function: RemoteFunction; container: any},
  parameters: unknown[],
  middlewares: Middleware[]
): Promise<unknown> {
  return invocationCache.invoke({clientId, itemName, parameters}, () => {
    const invokeItem = (...params: unknown[]) => {
      return item.function.call(item.container, ...params)
    }

    return withMiddlewares(middlewares, invokeItem, ...parameters, {})
  })
}

const defaultOptions: Omit<PublishServicesOptions, "port"> = {
  path: "",
  host: "0.0.0.0",
  middleware: [],
  pingInterval: 30 * 1000, // should be in-sync with client
}
