import {LocalTopicImpl, Method, ServiceItem, Transport} from "./core"

export async function createRpcServer(services: any, transport: Transport) {
  prepareLocal(services, transport)

  transport.listenCalls(async (itemName, body, respond) => {
    const item = getServiceItem(services, itemName)

    if (!item) return
    // warn about unhandled item

    if ("method" in item) {
      // local method request
      invokeMethod(item, body, respond)
    } else {
      // get data from topic
      getTopicData(item as any, body, respond)
    }
  })
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

export function prepareLocal(services: any, transport: Transport, prefix: string = "") {
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

      return prepareLocal(item, transport, name + ".")
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
