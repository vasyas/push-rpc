import {DataConsumer, DataSupplier, MessageType, Topic, TopicImpl} from "./rpc"
import {createMessageId} from "./utils"
import {RpcSession} from "./RpcSession"

/** LocalTopicImpl should implement Topic (and RemoteTopic) so it could be used in ServiceImpl */
export class LocalTopicImpl<D, F> extends TopicImpl implements Topic<D, F> {
  constructor(private supplier: DataSupplier<D, F>) {
    super()
  }

  name: string

  trigger(filter: Partial<F> = {}, suppliedData?: D): void {
    for (const subscription of Object.values(this.subscriptions)) {
      if (filterContains(filter, subscription.filter)) {
        // data cannot be cached between subscribers, b/c for different subscriber there could be a different context
        subscription.sessions.forEach(async session => {
          const data: D =
            suppliedData != undefined
              ? suppliedData
              : await this.supplier(subscription.filter, session.createContext())

          session.send(MessageType.Data, createMessageId(), this.name, subscription.filter, data)
        })
      }
    }
  }

  async getData(filter: F, ctx: any): Promise<D> {
    return await this.supplier(filter, ctx)
  }

  async subscribeSession(session: RpcSession, filter: F) {
    const key = JSON.stringify(filter)

    const subscription: Subscription<F> = this.subscriptions[key] || {
      filter,
      sessions: [],
    }

    subscription.sessions.push(session)
    this.subscriptions[key] = subscription

    if (this.supplier) {
      const data = await this.supplier(filter, session.createContext())
      session.send(MessageType.Data, createMessageId(), this.name, filter, data)
    }
  }

  unsubscribeSession(session: RpcSession, filter: F) {
    const key = JSON.stringify(filter)

    const subscription = this.subscriptions[key]
    if (!subscription) return

    const index = subscription.sessions.indexOf(session)
    subscription.sessions.splice(index, 1)

    if (!subscription.sessions.length) {
      delete this.subscriptions[key]
    }
  }

  private subscriptions: {[key: string]: Subscription<F>} = {}

  // dummy implementations, see class comment

  get(params?: F): Promise<D> {
    return undefined
  }
  subscribe(consumer: DataConsumer<D>, params: F, subscriptionKey: any): void {}
  unsubscribe(params?: F, subscriptionKey?: any) {}
}

function filterContains(container, filter): boolean {
  if (filter == null) return true // subscribe to all data
  if (container == null) return true // all data modified

  for (const key of Object.keys(filter)) {
    if (container[key] == undefined) continue
    if (filter[key] == container[key]) continue

    if (Array.isArray(container[key]) && Array.isArray(filter[key])) {
      if (JSON.stringify(container[key]) == JSON.stringify(filter[key])) {
        continue
      }
    }

    return false
  }

  return true
}

interface Subscription<F> {
  filter: F
  sessions: RpcSession[]
}

/**
 * 1. Set name on topics
 * 2. Bind this to remote methods
 */
export function prepareLocal(services, prefix = "") {
  const keys = getObjectProps(services)

  keys.forEach(key => {
    const item = services[key]

    if (typeof item == "object") {
      const name = prefix + key

      if (item instanceof LocalTopicImpl) {
        item.name = name
        return
      }

      return prepareLocal(item, name + "/")
    }
  })
}

function getObjectProps(obj) {
  let props = []

  while (!!obj && obj != Object.prototype) {
    props = props.concat(Object.getOwnPropertyNames(obj))
    obj = Object.getPrototypeOf(obj)
  }

  return Array.from(new Set(props)).filter(p => p != "constructor")
}
