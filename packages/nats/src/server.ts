import {JSONCodec, NatsConnection} from "nats"
import {Method, ServiceItem, Topic, DataSupplier, DataConsumer, LocalTopic} from "./core"

const codec = JSONCodec()

export async function createRpcServer(services: any, prefix: string, connection: NatsConnection) {
  // alternatively, walk all service items and subscribe individually
  const subscription = connection.subscribe(`${prefix}.>`)

  serverMessageLoop(services, prefix, subscription)
}

async function serverMessageLoop(services, prefix, subscription) {
  for await (const m of subscription) {
    const itemName = m.subject.substring(prefix.length + 1)
    const item = getServiceItem(services, itemName)

    if (!item) return
    // warn about unhandled item

    const body = codec.decode(m.data)

    if ("method" in item) {
      // local method request
      invokeMethod(item, body, r => m.respond(codec.encode(r)))
    } else {
      // get data from topic
      getTopicData(item as any, body, r => m.respond(codec.encode(r)))
    }
  }
}

async function invokeMethod(item: {method: Method; object: any}, req: any, respond) {
  const ctx = null
  const response = await item.method.call(item.object, req, ctx)
  respond(response)
}

async function getTopicData(
  item: {topic: LocalTopicImpl<never, any>; object: any},
  filter: any,
  respond
) {
  // TODO should have access to LocalTopic supplier

  const ctx = null
  const response = await item.topic.supplier(filter, ctx)
  respond(response)
}

export function getServiceItem(services: any, name: string): ServiceItem {
  if (!name) {
    return null
  }

  const names = name.split(".")

  const item = services[names[0]]

  if (typeof item == "object") {
    if ("getTopicName" in item) return {topic: item as any, object: services}

    if (!item) {
      return null
    }

    return getServiceItem(item as any, names.slice(1).join("."))
  }

  return {method: item, object: services}
}

export class LocalTopicImpl<D, F, TD = D> implements Topic<D, F, TD> {
  constructor(readonly supplier: DataSupplier<D, F>) {}

  private name: string

  getTopicName(): string {
    return this.name
  }

  setTopicName(s: string) {
    this.name = s
  }

  /**
   * Send data
   */
  trigger(p?: Partial<F>, data?: TD): void {}

  // only required fort ServiceImpl to implement Service interfaces
  async get(params?: F): Promise<D> {
    return undefined
  }
  async subscribe(consumer: DataConsumer<D>, params?: F, subscriptionKey?: any): Promise<any> {}
  unsubscribe(params?: F, subscriptionKey?: any) {}
}
