import {PublishServicesOptions, RpcServer} from "./index.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import http from "http"
import {ConnectionsServer} from "./ConnectionsServer.js"
import {PromiseCache} from "../utils/promises.js"
import {serveHttpRequest} from "./http.js"
import {RemoteFunction, RpcError, RpcErrors, Services} from "../rpc.js"
import {log} from "../logger.js"
import {withMiddlewares} from "../utils/middleware.js"
import {ServicesWithTriggers, withTriggers} from "./local.js"
import {safeParseJson, safeStringify} from "../utils/json.js"

export class RpcServerImpl<S extends Services> implements RpcServer {
  constructor(
    private readonly services: S,
    private readonly options: PublishServicesOptions
  ) {
    this.connectionsServer = new ConnectionsServer(
      this.httpServer,
      {pingInterval: options.pingInterval},
      (clientId) => {
        this.localSubscriptions.unsubscribeAll(clientId)
      }
    )

    this.httpServer.addListener("request", (req, res) =>
      serveHttpRequest(
        req,
        res,
        options.path,
        {
          call: this.call,
          subscribe: this.subscribe,
          unsubscribe: this.unsubscribe,
        },
        options.createContext
      )
    )
  }

  start() {
    return new Promise<void>((resolve, reject) => {
      this.httpServer.on("error", (err) => {
        reject(err)
      })

      this.httpServer.listen(this.options.port, this.options.host, () => {
        resolve()
      })
    })
  }

  async close() {
    await this.connectionsServer.close()
    await new Promise<void>((resolve, reject) => {
      this.httpServer.closeIdleConnections()
      this.httpServer.close((err) => {
        if (err) reject(err)
        else resolve(err)
      })
    })
  }

  createServicesWithTriggers(): ServicesWithTriggers<S> {
    return withTriggers(this.localSubscriptions, this.services)
  }

  _allSubscriptions() {
    return this.localSubscriptions._allSubscriptions()
  }

  private readonly localSubscriptions = new LocalSubscriptions()
  private readonly invocationCache = new PromiseCache()
  private readonly connectionsServer: ConnectionsServer
  private readonly httpServer = http.createServer()

  private call = async (
    clientId: string,
    itemName: string,
    parameters: unknown[]
  ): Promise<unknown> => {
    const item = this.getItem(itemName)

    if (!item) {
      throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
    }

    try {
      return await this.invokeItem(clientId, itemName, item, parameters)
    } catch (e) {
      log.error(`Cannot call item ${itemName}.`, e)
      throw e
    }
  }

  private subscribe = async (clientId: string, itemName: string, parameters: unknown[]) => {
    const item = this.getItem(itemName)

    if (!item) {
      throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
    }

    try {
      const data = await this.invokeItem(clientId, itemName, item, parameters)

      this.localSubscriptions.subscribe(clientId, itemName, parameters, async () => {
        try {
          const data = await this.invokeItem(clientId, itemName, item, parameters)

          // TODO do not send if data is the same

          this.connectionsServer.publish(clientId, itemName, parameters, data)
        } catch (e) {
          log.error("Cannot get data for subscription", e)
        }
      })

      return data
    } catch (e) {
      log.error(`Failed to subscribe ${itemName}`, e)
      throw e
    }
  }

  private unsubscribe = async (clientId: string, itemName: string, parameters: unknown[]) => {
    try {
      this.localSubscriptions.unsubscribe(clientId, itemName, parameters)
    } catch (e) {
      log.error(`Failed to unsubscribe ${itemName}`, e)
      throw e
    }
  }

  private getItem(
    itemName: string,
    root: any = this.services
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

  private invokeItem(
    clientId: string,
    itemName: string,
    item: {function: RemoteFunction; container: any},
    parameters: unknown[]
  ): Promise<unknown> {
    return this.invocationCache.invoke({clientId, itemName, parameters}, () => {
      const invokeItem = (...params: unknown[]) => {
        return item.function.call(item.container, ...params)
      }

      const parametersCopy: unknown[] = safeParseJson(safeStringify(parameters))

      const [ctx] = parametersCopy.splice(parametersCopy.length - 1, 1)

      return withMiddlewares(ctx, this.options.middleware, invokeItem, ...parametersCopy)
    })
  }
}
