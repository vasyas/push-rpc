import {getClassMethodNames} from "./utils"
import {TopicSubscription, Transport} from "./transport"
import {DataConsumer, RemoteTopic, Topic} from "./topic"
import {ITEM_NAME_SEPARATOR, Method} from "./utils"

export function createRpcClient(level: number, transport: Transport): Promise<any> {
  return createRemoteServiceItems(level, name => {
    // start with method
    const remoteItem = body => {
      return transport.call(name, body)
    }

    const remoteTopic = new RemoteTopicImpl(name, transport)

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
              itemName + ITEM_NAME_SEPARATOR
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
  constructor(private topicName: string, private transport: Transport) {}

  private getFilterKey(filter): string {
    // TODO normalize filter (sort keys)
    const filterKey = JSON.stringify(filter)
    return filterKey
  }

  async get(filter: F = {} as any): Promise<D> {
    return this.transport.call(this.topicName, filter)
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
      subscription.transportSubscription = this.transport.subscribeTopic(
        this.topicName,
        filter,
        data => this.receiveData(filter, data)
      )
    }

    subscription.consumers.push({
      consumer,
      subscriptionKey,
    })

    // only required for NATS?
    const initialData = await this.get(filter)
    this.receiveData(filter, initialData)

    return subscriptionKey
  }

  private receiveData = (filter: F, body: any) => {
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
        subscription.transportSubscription.unsubscribe()
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
  transportSubscription: TopicSubscription
}

interface SubscribedConsumer<D> {
  consumer: DataConsumer<D>
  subscriptionKey: any
}
