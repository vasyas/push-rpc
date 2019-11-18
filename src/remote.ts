import {RemoteTopic, DataConsumer, MessageType, Method, TopicImpl} from "./rpc"
import {log} from "./logger"
import {createMessageId, getClassMethodNames} from "./utils"
import {RpcSession, RpcSessionListeners} from "./RpcSession"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: string
}

export class RemoteTopicImpl<D, P> extends TopicImpl implements RemoteTopic<D, P> {
  constructor(private topicName: string, private session: RpcSession) {
    super()
  }

  subscribe(consumer: DataConsumer<D>, params: P = null, subscriptionKey: any = consumer) {
    const paramsKey = JSON.stringify(params)

    this.consumers[paramsKey] = [
      ...(this.consumers[paramsKey] || []),
      {consumer, subscriptionKey},
    ]

    this.session.send(MessageType.Subscribe, createMessageId(), this.topicName, params)
  }

  unsubscribe(params: P = null, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    // only if all unsubscribed?
    this.session.send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)

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
    return this.session.callRemote(this.topicName, params, MessageType.Get) as Promise<D>
  }

  resubscribe() {
    Object.keys(this.consumers).forEach(paramsKey => {
      const params = JSON.parse(paramsKey)
      this.session.send(MessageType.Subscribe, createMessageId(), this.topicName, params)
    })
  }

  receiveData(params: P, data: D) {
    const paramsKey = JSON.stringify(params)
    const subscriptions = this.consumers[paramsKey] || []
    subscriptions.forEach(subscription => subscription.consumer(data))
  }

  private consumers: {[key: string]: Subscription<D>[]} = {}
}

// TODO should be connection-specific
let errorDelay = 0

function connectionLoop(session: RpcSession, createWebSocket): Promise<void> {
  return new Promise((resolve) => {
    const ws = createWebSocket()

    ws.onmessage = (evt) => {
      try {
        session.handleMessage(evt.data)
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

      session.open(ws)

      errorDelay = 0
      resolve(ws)
    }

    ws.onclose = ({code}) => {
      log.debug("Disconnected")

      const timer = setTimeout(() => connectionLoop(session, createWebSocket), errorDelay)

      if (timer.unref) {
        timer.unref()
      }
    }
  })
}

const defaultListeners: RpcSessionListeners = {
  subscribed: () => {},
  unsubscribed: () => {},
  messageIn: () => {},
  messageOut: () => {},
}

export function createRpcClient<R = any>({level, createWebSocket, local = {}, listeners = {} }): Promise<R> {
  const session = new RpcSession(local, level, {...defaultListeners, ...listeners}, {}, (ctx, next) => next())

  return connectionLoop(session, createWebSocket).then(() => session.remote)
}

export function createRemote(level: number, session: RpcSession) {
  return createRemoteServiceItems(level, (name) => {
    // start with method
    const remoteItem = (params) => {
      return session.callRemote(name, params, MessageType.Call)
    }

    const remoteTopic = new RemoteTopicImpl(name, session)

    // make remoteItem both topic and remoteMethod
    getClassMethodNames(remoteTopic).forEach(methodName => {
      remoteItem[methodName] = (...args) => remoteTopic[methodName].apply(remoteTopic, args)
    })

    return remoteItem
  })
}

function createRemoteServiceItems(level, createServiceItem: (name) => RemoteTopic<any, any> | Method, prefix = ""): any {
  const cachedItems = {}

  return new Proxy({}, {
    get(target, name) {
      // skip internal props
      if (typeof name != "string") return target[name]

      // and promise-alike
      if (name == "then") return undefined

      if (!cachedItems[name]) {
        const itemName = prefix + name

        if (level > 0)
          cachedItems[name] = createRemoteServiceItems(level - 1, createServiceItem, itemName + "/")
        else
          cachedItems[name] = createServiceItem(itemName)
      }

      return cachedItems[name]
    },

    // Used in resubscribe
    ownKeys() {
      return Object.keys(cachedItems)
    }
  })
}