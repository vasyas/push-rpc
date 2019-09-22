import {ClientTopic, DataConsumer, getServiceItem, MessageType, RemoteMethod, Services, TopicImpl} from "./rpc"
import {log} from "./logger"
import {createMessageId, message} from "./utils"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}

interface ClientTopicImpl<P, D> extends ClientTopic<P, D> {
  resubscribe(): void
  receiveData(params: P, data: D): void
}


function clientTopic<P, D>(topicName): ClientTopicImpl<P, D> {
  const consumers: {[key: string]: Subscription<D>[]} = {}

  const r: any = new TopicImpl()

  Object.assign(r, {
    subscribe(params: P, consumer: DataConsumer<D>, subscriptionKey: any = consumer) {
      const paramsKey = JSON.stringify(params)

      consumers[paramsKey] = [
        ...(consumers[paramsKey] || []),
        {consumer, subscriptionKey},
      ]

      send(MessageType.Subscribe, createMessageId(), topicName, params)
    },

    resubscribe() {
      Object.keys(consumers).forEach(paramsKey => {
        const params = JSON.parse(paramsKey)

        send(MessageType.Subscribe, createMessageId(), topicName, params)
      })
    },

    unsubscribe(params: P, subscriptionKey = undefined) {
      const paramsKey = JSON.stringify(params)

      if (!consumers[paramsKey]) return

      // only if all unsubscribed?
      send(MessageType.Unsubscribe, createMessageId(), topicName, params)

      // unsubscribe all
      if (subscriptionKey == undefined) {
        delete consumers[paramsKey]
        return
      }

      const subscriptions = consumers[paramsKey]

      const idx = subscriptions.findIndex(s => s.subscriptionKey == subscriptionKey)
      if (idx >= 0) {
        if (subscriptions.length > 1) {
          subscriptions.splice(idx, 1)
        } else {
          delete consumers[paramsKey]
        }
      }
    },

    receiveData(params: P, data: D) {
      const paramsKey = JSON.stringify(params)

      const subscriptions = consumers[paramsKey] || []

      subscriptions.forEach(subscription => subscription.consumer(data))
    },

    get(params: P): Promise<D> {
      const id = createMessageId()
      return new Promise((resolve, reject) => {
        calls[id] = {resolve, reject}
        send(MessageType.Get, id, topicName, params)
      })
    },
  })

  return r
}


function callRemoteMethod(name) {
  return (params) => {
    return new Promise((resolve, reject) => {
      const id = createMessageId()
      calls[id] = {resolve, reject}
      send(MessageType.Call, id, name, params)
    })
  }
}

let services: Services
let ws
// both remote method calls and topics get
// TODO reject on timeout, expire calls cache
let calls: {[id: string]: {resolve, reject}} = {}

function send(type: MessageType, id: string, ...params) {
  const m = message(type, id, ...params)
  log.debug("Client out", m)
  ws.send(m)
}

function resubscribeTopics(topics) {
  Object.getOwnPropertyNames(topics).forEach(key => {
    if (topics[key] instanceof TopicImpl) {
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
        handleIncomingMessage(e)
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

      const timer = setTimeout(() => connect(createWebSocket), errorDelay)

      if (timer.unref) {
        timer.unref()
      }
    }
  })
}

export async function createRpcClient({level, createWebSocket}): Promise<any> {
  services = createServiceItems(level, (name) => {
    const remoteMethod = callRemoteMethod(name)

    Object.assign(remoteMethod, clientTopic(name))

    return remoteMethod
  })

  // TODO reconnecting cycle
  await connect(createWebSocket)
  return services
}

function createServiceItems(level, createServiceItem: (name) => ClientTopic<any, any> | RemoteMethod, prefix = ""): any {
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

function handleIncomingMessage(e) {
  log.debug("Client in", e.data)

  const [type, id, ...other] = JSON.parse(e.data)

  if (type == MessageType.Data) {
    const [name, params, data] = other

    const topic: ClientTopicImpl<any, any> = getServiceItem(services, name) as any
    topic.receiveData(params, data)
  }

  if (type == MessageType.Result || type == MessageType.Error) {
    if (calls[id]) {
      const {resolve, reject} = calls[id]
      delete calls[id]

      if (type == MessageType.Result) {
        resolve(other[0])
      } else {
        reject(other[0])
      }
    }
  }
}
