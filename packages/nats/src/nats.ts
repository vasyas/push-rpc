import {JSONCodec, NatsConnection} from "nats"
import {RemoteTopic, Topic} from "../../core/src"

const codec = JSONCodec()

export function createRpcClient(level: number, connection: NatsConnection): Promise<any> {
  return createRemoteServiceItems(level, name => {
    // start with method
    const remoteItem = async body => {
      const msg = await connection.request(name, codec.encode(body))
      return codec.decode(msg.data)
    }

    // const remoteTopic = new RemoteTopicImpl(name, session)

    // make remoteItem both topic and remoteMethod
    // getClassMethodNames(remoteTopic).forEach(methodName => {
    //   remoteItem[methodName] = (...args) => remoteTopic[methodName].apply(remoteTopic, args)
    // })

    return remoteItem
  })
}

function createRemoteServiceItems(
  level,
  createServiceItem: (name) => RemoteTopic<any, any> | Method,
  prefix = ""
): any {
  const cachedItems = {}

  return new Proxy(
    {},
    {
      get(target, name) {
        // skip internal props
        if (typeof name != "string") return target[name]

        // and promise-alike
        if (name == "then") return undefined

        if (!cachedItems[name]) {
          const itemName = prefix + name

          if (level > 0)
            cachedItems[name] = createRemoteServiceItems(
              level - 1,
              createServiceItem,
              itemName + "."
            )
          else cachedItems[name] = createServiceItem(itemName)
        }

        return cachedItems[name]
      },

      set(target, name, value) {
        cachedItems[name] = value
        return true
      },

      // Used in resubscribe
      ownKeys() {
        return Object.keys(cachedItems)
      },
    }
  )
}

export async function createRpcServer(services: any, connection: NatsConnection) {
  const subscription = connection.subscribe(">")

  serverMessageLoop(services, subscription)
}

async function serverMessageLoop(services, subscription) {
  for await (const m of subscription) {
    console.log("Got message", m.headers)

    const item = getServiceItem(services, m.subject)
    // warn about unhandled item

    if (!item) return

    const body = codec.decode(m.data)

    if ("method" in item) {
      const response = await item.method.call(item.object, body)

      m.respond(codec.encode(response))
      return
    }

    // const r = await item(request)
    // r.reply()
  }
}

type Method = (req?, ctx?) => Promise<any>
type ServiceItem = {method: Method; object: any} | {topic: Topic<never, never>; object: any}

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
