import {JSONCodec, NatsConnection} from "nats"
import {DataConsumer, Method, RemoteTopic, Topic} from "./core"
import {getClassMethodNames} from "../../core/src/utils"

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

    const remoteTopic = new RemoteTopicImpl(prefix + "." + name, connection)

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

export class RemoteTopicImpl<D, F> implements Topic<D, F> {
  constructor(private subject: string, private connection: NatsConnection) {}

  async get(params: F = {} as any): Promise<D> {
    const msg = await this.connection.request(this.subject, codec.encode(params))
    return codec.decode(msg.data)
  }

  async subscribe<SubscriptionKey = DataConsumer<D>>(
    consumer: DataConsumer<D>,
    filter: F = {} as any,
    subscriptionKey: SubscriptionKey = consumer as any
  ): Promise<SubscriptionKey> {
    return null
  }

  unsubscribe(params: F = {} as any, subscriptionKey = undefined) {}

  /*

    async subscribe<SubscriptionKey = DataConsumer<D>>(
      consumer: DataConsumer<D>,
      filter: F = {} as any,
      subscriptionKey: SubscriptionKey = consumer as any
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
        await this.session.callRemote(this.topicName, filter, MessageType.Subscribe)
      } catch (e) {
        this.unsubscribe(filter, subscriptionKey)
        throw e
      }

      return subscriptionKey
    }

    unsubscribe(params: F = {} as any, subscriptionKey = undefined) {
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

     */

  // this is only to easy using for remote services during tests
  trigger(p?: F, data?: D): void {}
}
