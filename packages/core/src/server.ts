import {log} from "./logger"
import {DataConsumer, DataSupplier, Topic} from "./topic"
import {Transport} from "./transport"
import {InvocationType, ITEM_NAME_SEPARATOR, Middleware} from "./utils"

export interface RpcServerOptions {
  middleware?: Middleware
}

const defaultOptions: Partial<RpcServerOptions> = {
  middleware: (ctx, next, params) => next(params),
}

export async function createRpcServer(
  services: any,
  transport: Transport,
  options: RpcServerOptions = {}
) {
  options = {
    ...defaultOptions,
    ...options,
  }

  prepareLocal(services, transport)

  transport.listenCalls(async (itemName, body, success, error) => {
    const item = getServiceItem(services, itemName)
    if (!item) {
      log.warn(`Unknown item ${itemName}`)
      return
    }

    invokeItem(itemName, item, body, options.middleware, success, error)
  })
}

async function invokeItem(
  itemName: string,
  item: ServiceItem,
  req: any,
  middleware: Middleware,
  success,
  error
) {
  const ctx = createContext()

  try {
    const impl = (p = req) => item.target(p, ctx)
    const response = await middleware(ctx, impl, req, item.invocationType)
    success(response)
  } catch (e) {
    log.error(`While invoking ${itemName}`, e)
    error(e)
  }
}

function createContext() {
  return {}
}

type ServiceItem = {
  invocationType: InvocationType
  target: (req, ctx) => Promise<any>
}

function getServiceItem(services: any, name: string): ServiceItem {
  if (!name) {
    return null
  }

  const names = name.split(ITEM_NAME_SEPARATOR)

  const item = services[names[0]]

  if (typeof item == "object") {
    if ("getTopicName" in item)
      // TODO a better way to access supplier
      return {
        target: (p, ctx) => (item as LocalTopicImpl<any, any>).supplier(p, ctx),
        invocationType: InvocationType.Get,
      }

    if (!item) {
      return null
    }

    return getServiceItem(item as any, names.slice(1).join(ITEM_NAME_SEPARATOR))
  }

  return {
    target: (p, ctx) => item.call(services, p, ctx),
    invocationType: InvocationType.Call,
  }
}

function prepareLocal(services: any, transport: Transport, prefix: string = "") {
  const keys = getObjectProps(services)

  keys.forEach(key => {
    const item = services[key]

    if (typeof item == "object") {
      const name = prefix + key

      if ("setTransport" in item) {
        item.setTransport(transport)
      }

      if ("setTopicName" in item) {
        item.setTopicName(name)
        return
      }

      return prepareLocal(item, transport, name + ITEM_NAME_SEPARATOR)
    }
  })
}

function getObjectProps(obj) {
  let props = []

  while (!!obj && obj != Object.prototype) {
    props = props.concat(Object.getOwnPropertyNames(obj))
    obj = Object.getPrototypeOf(obj)
  }

  return Array.from(new Set(props)).filter(p => p != "constructor")
}

export class LocalTopicImpl<D, F, TD = D> implements Topic<D, F, TD> {
  constructor(readonly supplier: DataSupplier<D, F>) {}

  private name: string
  private transport: Transport

  getTopicName(): string {
    return this.name
  }

  setTopicName(s: string) {
    this.name = s
  }

  setTransport(transport: Transport) {
    this.transport = transport
  }

  /**
   * Send data
   */
  trigger(p: Partial<F> = {}, data?: TD): void {
    if (!this.transport)
      throw new Error(`Topic ${this.name} transport is not set, server probably not started`)
    ;(async () => {
      if (data === undefined) {
        data = (await this.supplier(p as any, null)) as any
      }

      this.transport.publish(this.getTopicName(), p, data)
    })()
  }

  // only required fort ServiceImpl to implement Service interfaces
  async get(params?: F): Promise<D> {
    return undefined
  }

  async subscribe(consumer: DataConsumer<D>, params?: F, subscriptionKey?: any): Promise<any> {}

  unsubscribe(params?: F, subscriptionKey?: any) {}
}
