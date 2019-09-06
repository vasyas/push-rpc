import {ClientTopic, DataConsumer, getServiceItem, RemoteMethod, RequestType, Services, TopicImpl} from "./rpc"
import {log} from "./logger"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}

class ClientTopicImpl<P, D> extends TopicImpl<P, D> implements ClientTopic<P, D> {
  constructor(private name, private send: (message: string) => void) {
    super()
  }

  subscribe(params: P, consumer: DataConsumer<D>, subscriptionKey: any = consumer) {
    const paramsKey = JSON.stringify(params)

    this.consumers[paramsKey] = [
      ...(this.consumers[paramsKey] || []),
      {consumer, subscriptionKey},
    ]

    this.send(JSON.stringify([RequestType.Subscribe, this.name, params]))
  }

  resubscribe() {
    Object.keys(this.consumers).forEach(paramsKey => {
      const params = JSON.parse(paramsKey)

      this.send(JSON.stringify([RequestType.Subscribe, this.name, params]))
    })
  }

  unsubscribe(params: P, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    this.send(JSON.stringify([RequestType.Unsubscribe, this.name, params]))

    // unsubscribe all
    if (subscriptionKey == undefined) {
      delete this.consumers[paramsKey]
      return
    }

    const subscriptions = this.consumers[paramsKey]

    const idx = subscriptions.findIndex(s => s.subscriptionKey == subscriptionKey)
    if (idx >= 0) {
      if (subscriptions.length > 1) {
        subscriptions.splice(idx, 1)
      } else {
        delete this.consumers[paramsKey]
      }
    }
  }

  receiveData(params: P, data: D) {
    const paramsKey = JSON.stringify(params)

    const subscriptions = this.consumers[paramsKey] || []

    subscriptions.forEach(subscription => subscription.consumer(data))
  }

  private consumers: {[key: string]: Subscription<D>[]} = {}
}

function callRemoteMethod(name) {
  return async (req) => {
    ws.send(JSON.stringify([RequestType.Call, name, req]))
    // TODO save promise; wait for results come from WS
  }
}

let services: Services
let ws

function resubscribeTopics(topics) {
  Object.getOwnPropertyNames(topics).forEach(key => {
    if (topics[key] instanceof ClientTopicImpl) {
      topics[key].resubscribe()
    } else if (topics[key] && typeof topics[key] == "object") {
      resubscribeTopics(topics[key])
    }
  })
}

let errorDelay = 0

function connect(createWebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws = createWebSocket()

    ws.onmessage = (e) => {
      try {
        handleData(e)
      } catch (e) {
        log.error(`Failed to handle data`, e)
      }
    }

    ws.onerror = e => {
      errorDelay = Math.random() * 15 * 1000
      log.warn("Connection error", e)
      ws.close()
    }

    ws.onopen = () => {
      log.debug("Connected")

      errorDelay = 0
      resubscribeTopics(services)
      resolve()
    }

    ws.onclose = ({code}) => {
      log.debug("Disconnected")

      const delay = errorDelay

      setTimeout(() => connect(createWebSocket), delay)
    }
  })
}

export async function createRpcClient({level, createWebSocket, isTopic = guessTopic}): Promise<any> {
  function send(message) {
    ws.send(message)
  }

  services = createServiceItems(level, (name) => {
    if (isTopic(name))
      return new ClientTopicImpl(name, send)

    return callRemoteMethod(name)
  })

  // TODO reconnecting cycle
  await connect(createWebSocket)
  return services
}

function guessTopic(name) {
  const names = name.split("/")

  const methods = ["get", "set", "create", "make", "remove", "delete", "find"]

  for (const method of methods) {
    if (names[names.length - 1].startsWith(method)) {
      return false
    }
  }

  return true
}

type ServiceItemClient = ClientTopic<any, any> | RemoteMethod

function createServiceItems(level, createServiceItem: (name) => ServiceItemClient, prefix = ""): any {
  const cachedItems = {}

  return new Proxy({}, {
    get(target, name) {
      // skip internal props
      if (typeof name != "string") return target[name]

      if (!cachedItems[name]) {
        const childName = prefix + "/" + name

        if (level > 0)
          cachedItems[name] = createServiceItems(level - 1, createServiceItem, childName)
        else
          cachedItems[name] = createServiceItem(childName)
      }

      return cachedItems[name]
    },

    ownKeys() {
      return Object.keys(cachedItems)
    }
  })
}

function handleData(e) {
  const [topicName, params, data] = JSON.parse(e.data)

  const topic = getServiceItem(services, topicName) as ClientTopicImpl<any, any>
  topic.receiveData(params, data)
}