import {PublishServicesOptions, RpcServer} from "./index.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import http from "http"
import {ConnectionsServer} from "./ConnectionsServer.js"
import {PromiseCache} from "../utils/promises.js"
import {serveHttpRequest} from "./http.js"
import {
  InvocationType,
  RemoteFunction,
  RpcConnectionContext,
  RpcContext,
  RpcError,
  RpcErrors,
  Services,
} from "../rpc.js"
import {log} from "../logger.js"
import {withMiddlewares} from "../utils/middleware.js"
import {ServicesWithTriggers, withTriggers} from "./local.js"
import {safeParseJson, safeStringify} from "../utils/json.js"

export class RpcServerImpl<S extends Services, C extends RpcContext> implements RpcServer {
  constructor(
    private readonly services: S,
    private readonly options: PublishServicesOptions<C>
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
        options.createConnectionContext
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
    connectionContext: RpcConnectionContext,
    itemName: string,
    parameters: unknown[]
  ): Promise<unknown> => {
    const item = this.getItem(itemName)

    if (!item) {
      throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
    }

    try {
      return await this.invokeLocalFunction(
        connectionContext,
        itemName,
        item,
        parameters,
        InvocationType.Call
      )
    } catch (e) {
      log.error(`Cannot call item ${itemName}.`, e)
      throw e
    }
  }

  private subscribe = async (
    connectionContext: RpcConnectionContext,
    itemName: string,
    parameters: unknown[]
  ) => {
    const item = this.getItem(itemName)

    if (!item) {
      throw new RpcError(RpcErrors.NotFound, `Item ${itemName} not found`)
    }

    try {
      let lastData = await this.invokeLocalFunction(
        connectionContext,
        itemName,
        item,
        parameters,
        InvocationType.Subscribe
      )

      const update = this.localSubscriptions.throttled(itemName, async (suppliedData?: unknown) => {
        try {
          const newData =
            suppliedData !== undefined
              ? suppliedData
              : await this.invokeLocalFunction(
                  connectionContext,
                  itemName,
                  item,
                  parameters,
                  InvocationType.Trigger
                )

          if (safeStringify(newData) != safeStringify(lastData)) {
            lastData = newData
            this.connectionsServer.publish(
              connectionContext.clientId,
              itemName,
              parameters,
              newData
            )
          }
        } catch (e) {
          log.error("Cannot get data for subscription", e)
        }
      })

      this.localSubscriptions.subscribe(connectionContext.clientId, itemName, parameters, update)

      return lastData
    } catch (e) {
      log.error(`Failed to subscribe ${itemName}`, e)
      throw e
    }
  }

  private unsubscribe = async (
    connectionContext: RpcConnectionContext,
    itemName: string,
    parameters: unknown[]
  ) => {
    try {
      this.localSubscriptions.unsubscribe(connectionContext.clientId, itemName, parameters)
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

  private invokeLocalFunction(
    connectionContext: RpcConnectionContext,
    itemName: string,
    item: {function: RemoteFunction; container: any},
    parameters: unknown[],
    invocationType: InvocationType
  ): Promise<unknown> {
    return this.invocationCache.invoke(
      {clientId: connectionContext.clientId, itemName, parameters},
      () => {
        const parametersCopy: unknown[] = safeParseJson(safeStringify(parameters))

        const ctx = safeParseJson(safeStringify(connectionContext)) as C
        ctx.itemName = itemName
        ctx.invocationType = invocationType

        const invokeItem = (...params: unknown[]) => {
          return item.function.call(item.container, ...params, ctx)
        }
        return withMiddlewares<C>(ctx, this.options.middleware, invokeItem, ...parametersCopy)
      }
    )
  }
}
