import {ClientTopic, DataConsumer, getServiceItem, MessageType, RemoteMethod, Services, TopicImpl} from "./rpc"
import {log} from "./logger"
import {createMessageId, dateReviver, getClassMethodNames, message} from "./utils"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: string
}

class ClientTopicImpl<D, P> extends TopicImpl implements ClientTopic<D, P> {
  constructor(private topicName: string) {
    super()
  }

  subscribe(consumer: DataConsumer<D>, params: P = null, subscriptionKey: any = consumer) {
    const paramsKey = JSON.stringify(params)

    this.consumers[paramsKey] = [
      ...(this.consumers[paramsKey] || []),
      {consumer, subscriptionKey},
    ]

    send(MessageType.Subscribe, createMessageId(), this.topicName, params)
  }

  unsubscribe(params: P = null, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    // only if all unsubscribed?
    send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)

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

  get(params: P = null): Promise<D> {
    const id = createMessageId()
    return new Promise((resolve, reject) => {
      calls[id] = {resolve, reject}
      send(MessageType.Get, id, this.topicName, params)
    })
  }

  resubscribe() {
    Object.keys(this.consumers).forEach(paramsKey => {
      const params = JSON.parse(paramsKey)

      send(MessageType.Subscribe, createMessageId(), this.topicName, params)
    })
  }

  receiveData(params: P, data: D) {
    const paramsKey = JSON.stringify(params)

    const subscriptions = this.consumers[paramsKey] || []

    subscriptions.forEach(subscription => subscription.consumer(data))
  }

  private consumers: {[key: string]: Subscription<D>[]} = {}
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

function resubscribeTopics(services) {
  Object.getOwnPropertyNames(services).forEach(key => {
    if (typeof services[key] == "object") {
      resubscribeTopics(services[key])
    } else {
      services[key].resubscribe()
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

    const topic = new ClientTopicImpl(name)

    // make serviceItem both topic and remoteMethod
    getClassMethodNames(topic).forEach(methodName => {
      remoteMethod[methodName] = (...args) => topic[methodName].apply(topic, args)
    })

    return remoteMethod
  })

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

    // Used in resubscribe
    ownKeys() {
      return Object.keys(cachedItems)
    }
  })
}

function handleIncomingMessage(e) {
  log.debug("Client in", e.data)

  const [type, id, ...other] = JSON.parse(e.data, dateReviver)

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
