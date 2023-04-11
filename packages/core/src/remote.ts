import {
  CallOptions,
  DataConsumer,
  LocalTopic,
  MessageType,
  Method,
  RemoteTopic,
  TopicImpl,
} from "./rpc"
import {RpcSession} from "./RpcSession"
import {createMessageId, getClassMethodNames} from "./utils"

interface Subscription<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}

export class RemoteTopicImpl<D, F> extends TopicImpl
  implements RemoteTopic<D, F>, LocalTopic<D, F> {
  constructor(private topicName: string, private session: RpcSession) {
    super()
  }

  async subscribe<SubscriptionKey = DataConsumer<D>>(
    consumer: DataConsumer<D>,
    filter: F = {} as any,
    subscriptionKey: SubscriptionKey = consumer as any,
    callOpts?: CallOptions
  ): Promise<SubscriptionKey> {
    if (filter === null) {
      throw new Error(
        "Subscribe with null filter is not supported, use empty object to get all data"
      )
    }

    const paramsKey = JSON.stringify(filter)

    // already have cached value with this params?
    if (this.cached[paramsKey] !== undefined) {
      consumer(this.cached[paramsKey])
    }

    this.consumers[paramsKey] = [...(this.consumers[paramsKey] || []), {consumer, subscriptionKey}]

    try {
      await this.session.callRemote(this.topicName, filter, MessageType.Subscribe, callOpts)
    } catch (e) {
      this.unsubscribe(filter, subscriptionKey)
      throw e
    }

    return subscriptionKey
  }

  unsubscribe(params: F = {} as any, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    // session.send and not session.callRemote because unsubscribe doesn't yield any response from the server side
    this.session.send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)

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

  get(params: F = {} as any, callOpts?: CallOptions): Promise<D> {
    return this.session.callRemote(this.topicName, params, MessageType.Get, callOpts) as Promise<D>
  }

  resubscribe() {
    Object.keys(this.consumers).forEach(paramsKey => {
      const params = JSON.parse(paramsKey)

      // session.send and not session.callRemote b/c we don't want resubscribes to be pass thru middleware
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

  // this is only to easy using for remote services during tests
  trigger(p?: F, data?: D): void {}
}

export function createRemote(level: number, session: RpcSession) {
  return createRemoteServiceItems(level, name => {
    // start with method
    const remoteItem = (params, callOpts?) => {
      return session.callRemote(name, params, MessageType.Call, callOpts)
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

        // and other props
        if (["then", "toJSON"].indexOf(name) >= 0) return undefined

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
