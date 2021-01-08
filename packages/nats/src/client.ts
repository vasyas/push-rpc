import {JSONCodec, NatsConnection, Subscription as NatsSubscription} from "nats"
import {getClassMethodNames} from "../../core/src/utils"
import {DataConsumer, Method, RemoteTopic, Topic} from "./core"
import {subscribeAndHandle} from "./utils"

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

    const remoteTopic = new RemoteTopicImpl(prefix, name, connection)

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
  constructor(
    private prefix: string,
    private topicName: string,
    private connection: NatsConnection
  ) {}

  private getTopicSubject(): string {
    // TODO include filter params!
    return this.prefix + "." + this.topicName
  }

  private getFilterKey(filter): string {
    // TODO normalize filter (sort keys)
    const filterKey = JSON.stringify(filter)
    return filterKey
  }

  async get(filter: F = {} as any): Promise<D> {
    // TODO encode filter in subject instead of passing in body?
    const msg = await this.connection.request(this.getTopicSubject(), codec.encode(filter))
    return codec.decode(msg.data)
  }

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

    const filterKey = this.getFilterKey(filter)

    // already have cached value with this params?
    const subscription: Subscription<D> = this.subscriptions[filterKey] || {
      cached: undefined,
      consumers: [],
      transportSubscription: null,
    }
    this.subscriptions[filterKey] = subscription

    // can supply value early without network round trip
    if (subscription?.cached !== undefined) {
      consumer(subscription.cached)
    }

    if (!subscription.transportSubscription) {
      subscription.transportSubscription = subscribeAndHandle(
        this.connection,
        this.getTopicSubject(),
        (_, body) => this.receiveData(filter, body)
      )
    }

    // TODO send request for 1st data!! (same as get?)

    subscription.consumers.push({
      consumer,
      subscriptionKey,
    })

    return subscriptionKey
  }

  private receiveData = (filter: F, body: any) => {
    // TODO get params from subject instead of passing?

    const subscription = this.subscriptions[this.getFilterKey(filter)]
    subscription.cached = body

    subscription.consumers.forEach(c => {
      c.consumer(body)
    })
  }

  unsubscribe(params: F = {} as any, subscriptionKey = undefined) {
    const paramsKey = this.getFilterKey(params)

    const subscription = this.subscriptions[paramsKey]
    if (!subscription) return

    const idx = subscription.consumers.findIndex(s => s.subscriptionKey == subscriptionKey)
    if (idx >= 0) {
      if (subscription.consumers.length > 1) {
        subscription.consumers.splice(idx, 1)
      } else {
        subscription.transportSubscription.unsubscribe() // TODO or .drain?
        delete this.subscriptions[paramsKey]
      }
    }
  }

  private subscriptions: {[filterKey: string]: Subscription<D>} = {}

  // this is only to easy using for remote services during tests
  trigger(p?: F, data?: D): void {}
}

interface Subscription<D> {
  cached: D
  consumers: SubscribedConsumer<D>[]
  transportSubscription: NatsSubscription
}

interface SubscribedConsumer<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}
