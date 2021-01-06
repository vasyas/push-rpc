import {JSONCodec, NatsConnection} from "nats"
import {RemoteTopic, Topic} from "../../core/src"

const codec = JSONCodec()

export function createRpcClient(
  level: number,
  prefix: string,
  connection: NatsConnection
): Promise<any> {
  return createRemoteServiceItems(level, name => {
    // start with method
    const remoteItem = async body => {
      const msg = await connection.request(prefix + "." + name, codec.encode(body))
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

    console.log(`Start call ${body} subj ${m.subject}`)

    if ("method" in item) {
      setTimeout(() => {
        invokeMethod(item, body, m)
      }, 0)
    } else {
    }
  }
}

async function invokeMethod(item: {method: Method; object: any}, body: any, m) {
  const response = await item.method.call(item.object, body)

  console.log("Responding call " + body)

  m.respond(codec.encode(response))

  console.log("Responded call " + body)
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
