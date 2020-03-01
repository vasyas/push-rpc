import {DataConsumer, MessageType, Method, RemoteTopic, TopicImpl} from "./rpc"
import {createMessageId, getClassMethodNames} from "./utils"
import {RpcSession} from "./RpcSession"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}

export class RemoteTopicImpl<D, F> extends TopicImpl implements RemoteTopic<D, F> {
  constructor(private topicName: string, private session: RpcSession) {
    super()
  }

  subscribe<SubscriptionKey = DataConsumer<D>>(
    consumer: DataConsumer<D>,
    params: F = null,
    subscriptionKey: SubscriptionKey = consumer as any
  ): SubscriptionKey {
    const paramsKey = JSON.stringify(params)

    this.consumers[paramsKey] = [...(this.consumers[paramsKey] || []), {consumer, subscriptionKey}]

    this.session.send(MessageType.Subscribe, createMessageId(), this.topicName, params)

    if (this.cached[paramsKey] !== undefined) {
      consumer(this.cached[paramsKey])
    }

    return subscriptionKey
  }

  unsubscribe(params: F = null, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    // only if all unsubscribed?
    this.session.send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)

    // unsubscribe all
    if (subscriptionKey == undefined) {
      this.deleteAllSubscriptions(paramsKey)
      return
    }

    const subscriptions = this.consumers[paramsKey]

    const idx = subscriptions.findIndex(s => s.subscriptionKey == subscriptionKey)
    if (idx >= 0) {
      if (subscriptions.length > 1) {
        subscriptions.splice(idx, 1)
      } else {
        this.deleteAllSubscriptions(paramsKey)
      }
    }
  }

  private deleteAllSubscriptions(paramsKey: string) {
    delete this.consumers[paramsKey]
    delete this.cached[paramsKey]
  }

  get(params: F = null): Promise<D> {
    return this.session.callRemote(this.topicName, params, MessageType.Get) as Promise<D>
  }

  resubscribe() {
    Object.keys(this.consumers).forEach(paramsKey => {
      const params = JSON.parse(paramsKey)
      this.session.send(MessageType.Subscribe, createMessageId(), this.topicName, params)
    })
  }

  receiveData(params: F, data: D) {
    const paramsKey = JSON.stringify(params)
    const subscriptions = this.consumers[paramsKey] || []
    this.cached[paramsKey] = data
    subscriptions.forEach(subscription => subscription.consumer(data))
  }

  private consumers: {[paramsKey: string]: Subscription<D>[]} = {}
  private cached: {[paramsKey: string]: D} = {}
}

export function createRemote(level: number, session: RpcSession) {
  return createRemoteServiceItems(level, name => {
    // start with method
    const remoteItem = params => {
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
              itemName + "/"
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
