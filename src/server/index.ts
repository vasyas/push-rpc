import {RemoteFunction, RpcError, RpcErrors, Services} from "../rpc.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import {withTriggers} from "./local.js"
import http from "http"
import {serveHttpRequest} from "./http.js"
import {Middleware, withMiddlewares} from "../utils/middleware.js"
import {log} from "../logger.js"
import {ConnectionsServer} from "./ConnectionsServer.js"

export type ServicesWithTriggers<T extends Services> = {
  [K in keyof T]: T[K] extends Services
    ? ServicesWithTriggers<T[K]>
    : T[K] extends RemoteFunction
      ? T[K] & {trigger(filter?: Partial<Parameters<T[K]>[0]>): void}
      : never
}


export type RpcServer = {
  shutdown(): Promise<void>
}

export type PublishServicesOptions = {
  port: number
  path: string
  host: string
}

export function publishServices<S extends Services>(
  services: S,
  options: Partial<PublishServicesOptions> = {}
): Promise<{
  server: RpcServer,
  services: ServicesWithTriggers<S>
}> {
  const opts = {
    ...defaultOptions,
    ...options,
  }

  const localSubscriptions = new LocalSubscriptions()

  const middlewares: Middleware[] = []

  const connectionsServer = new ConnectionsServer()

  const httpServer = http.createServer((req, res) => serveHttpRequest(req, res, opts.path, {
    async call(clientId: string, itemName: string, parameters: unknown[]): Promise<unknown> {
      const item = getItem(services, itemName)

      if (!item) {
        throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
      }

      try {
        return await invokeItem(clientId, item, parameters, middlewares)
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
        const data = await invokeItem(clientId, item, parameters, middlewares)

        localSubscriptions.subscribe(clientId, itemName, parameters, async () => {
          try {
            const data = await invokeItem(clientId, item, parameters, middlewares)

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
    }
  }))

  function shutdown() {
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

    httpServer.listen(opts.port, opts.host, () => {
      resolve({
        services: withTriggers(localSubscriptions, services),
        server: {
          shutdown
        }
      })
    })
  })
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

  return {
    function: item,
    container: parent,
  }
}

function invokeItem(
  clientId: string,
  item: {function: RemoteFunction; container: any},
  parameters: unknown[],
  middlewares: Middleware[]
): Promise<unknown> {
  const invokeItem = (...params: unknown[]) => {
    return item.function.call(item.container, ...params)
  }

  return withMiddlewares(middlewares, invokeItem, ...parameters, {})
}

const defaultOptions: Omit<PublishServicesOptions, "port"> = {
  path: "",
  host: "0.0.0.0"
}