import {CallOptions, DataConsumer, LocalTopic, MessageType, RemoteTopic, TopicImpl} from "./rpc"
import {RpcSession, skippedRemoteProps} from "./RpcSession"
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

    const alreadySubscribed = !!this.consumers[paramsKey]

    this.consumers[paramsKey] = [...(this.consumers[paramsKey] || []), {consumer, subscriptionKey}]

    if (alreadySubscribed) {
      // refetch latest data

      try {
        const data = await this.session.callRemote(
          this.topicName,
          filter,
          MessageType.Get,
          callOpts
        )
        this.receiveData(filter, data)
      } catch (e) {
        this.unsubscribe(filter, subscriptionKey)
        throw e
      }
    } else {
      // do not subscribe if already subscribed
      try {
        await this.session.callRemote(this.topicName, filter, MessageType.Subscribe, callOpts)
      } catch (e) {
        this.unsubscribe(filter, subscriptionKey)
        throw e
      }
    }

    return subscriptionKey
  }

  unsubscribe(params: F = {} as any, subscriptionKey = undefined) {
    const paramsKey = JSON.stringify(params)

    if (!this.consumers[paramsKey]) return

    const subscriptions = this.consumers[paramsKey]

    if (subscriptionKey == null) {
      if (subscriptions.length > 0) {
        this.deleteAllSubscriptions(paramsKey)

        this.session.send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)
      }

      return
    }

    const idx = subscriptions.findIndex(s => s.subscriptionKey == subscriptionKey)

    if (idx >= 0) {
      if (subscriptions.length > 1) {
        subscriptions.splice(idx, 1)
      } else {
        this.deleteAllSubscriptions(paramsKey)

        this.session.send(MessageType.Unsubscribe, createMessageId(), this.topicName, params)
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
  async getData(p: F, callContext: unknown, connectionContext: unknown): Promise<D> {
    return undefined
  }
}

export function createRemote(session: RpcSession, name = "") {
  // start with method
  const remoteItem = (params, callOpts?) => {
    return session.callRemote(name, params, MessageType.Call, callOpts)
  }

  // then add topic methods
  const remoteTopic = new RemoteTopicImpl(name, session)

  // make remoteItem both topic and remoteMethod
  const remoteTopicProps = getClassMethodNames(remoteTopic)
  remoteTopicProps.forEach(methodName => {
    remoteItem[methodName] = (...args) => remoteTopic[methodName].apply(remoteTopic, args)
  })

  // then add proxy creating subitems

  const cachedItems = {}

  return new Proxy(remoteItem, {
    get(target, propName) {
      // skip internal props
      if (typeof propName != "string") return target[propName]

      // skip other system props
      if (["then", "catch", "toJSON", ...skippedRemoteProps].includes(propName))
        return target[propName]

      // skip topic methods
      if (remoteTopicProps.includes(propName)) return target[propName]

      if (!cachedItems[propName]) {
        cachedItems[propName] = createRemote(session, name ? name + "/" + propName : propName)
      }

      return cachedItems[propName]
    },

    set(target, propName, value) {
      cachedItems[propName] = value
      return true
    },

    // Used in resubscribe
    ownKeys() {
      return [...skippedRemoteProps, ...Object.keys(cachedItems)]
    },
  })
}
