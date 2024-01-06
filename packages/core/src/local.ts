import {DataConsumer, DataSupplier, MessageType, Topic, TopicImpl} from "./rpc"
import {lastValueReducer, throttle, ThrottleArgsReducer} from "./throttle"
import {createMessageId, PromiseCache} from "./utils"
import {RpcSession} from "./RpcSession"

// Intentionally skipped type checks b/c types are checked with isArray
export function groupReducer<D>(prevValue: any, newValue: any): any {
  if (!Array.isArray(newValue))
    throw new Error("groupReducer should only be used with topics that return arrays")

  return prevValue ? [...prevValue, ...newValue] : newValue
}

export interface LocalTopicImplOpts<D, F, TD> {
  throttleTimeout: number
  throttleReducer: ThrottleArgsReducer<D>
  triggerMapper: (d: TD, filter: F) => Promise<D>
}

/** LocalTopicImpl should implement Topic (and RemoteTopic) so it could be used in ServiceImpl */
export class LocalTopicImpl<D, F, TD = D> extends TopicImpl implements Topic<D, F, TD> {
  constructor(
    private readonly supplier: DataSupplier<D, F>,
    private readonly opts: Partial<LocalTopicImplOpts<D, F, TD>> = {}
  ) {
    super()

    this.opts = {
      triggerMapper: async d => d as any,
      throttleReducer: lastValueReducer,
      throttleTimeout: 500,
      ...this.opts,
    }
  }

  private name: string

  getTopicName(): string {
    return this.name
  }

  setTopicName(s: string) {
    this.name = s
  }

  trigger(filter: Partial<F> = {}, suppliedData?: TD): void {
    for (const subscription of Object.values(this.subscriptions)) {
      if (filterContains(filter, subscription.filter)) {
        subscription.trigger(suppliedData)
      }
    }
  }

  private dataSupplierCache = new PromiseCache<F, D>()

  async getData(filter: F, callContext: unknown, connectionContext: unknown = {}): Promise<D> {
    return await this.dataSupplierCache.invoke({filter, connectionContext}, () =>
      this.supplier(filter, callContext)
    )
  }

  private throttled(f) {
    if (!this.opts.throttleTimeout) return f

    return throttle(f, this.opts.throttleTimeout, this.opts.throttleReducer)
  }

  async subscribeSession(session: RpcSession, filter: F, messageId, ctx) {
    const key = JSON.stringify(filter)
    const thisTopic = this

    const subscription: Subscription<F, D, TD> = this.subscriptions[key] || {
      filter,
      sessions: [],
      trigger: this.throttled(function(suppliedData) {
        // data cannot be cached between subscribers, b/c for different subscriber there could be a different context
        this.sessions.forEach(async session => {
          const data: D =
            suppliedData !== undefined
              ? await thisTopic.opts.triggerMapper(suppliedData, filter)
              : await thisTopic.getData(
                  filter,
                  session.createContext(),
                  session.getConnectionContext()
                )

          session.send(MessageType.Data, createMessageId(), thisTopic.getTopicName(), filter, data)
        })
      }),
    }

    subscription.sessions.push(session)
    this.subscriptions[key] = subscription

    try {
      return await this.getData(filter, ctx, session.getConnectionContext())
    } catch (e) {
      this.unsubscribeSession(session, filter)
      throw e
    }
  }

  unsubscribeSession(session: RpcSession, filter: F) {
    const key = JSON.stringify(filter)

    const subscription = this.subscriptions[key]
    if (!subscription) return

    const index = subscription.sessions.indexOf(session)
    if (index >= 0) {
      subscription.sessions.splice(index, 1)
    }

    if (!subscription.sessions.length) {
      delete this.subscriptions[key]
    }
  }

  protected subscriptions: {[key: string]: Subscription<F, D, TD>} = {}

  isSubscribed(): boolean {
    return !!this.subscriptions.length
  }

  // dummy implementations, see class comment

  get(params?: F): Promise<D> {
    return undefined
  }
  async subscribe(consumer: DataConsumer<D>, params: F, subscriptionKey: any) {}
  unsubscribe(params?: F, subscriptionKey?: any) {}
}

function filterContains(triggerFilter, subscriptionFilter): boolean {
  if (subscriptionFilter == null) return true // subscribe to all data
  if (triggerFilter == null) return true // all data modified

  for (const key of Object.keys(subscriptionFilter)) {
    if (triggerFilter[key] == undefined) continue
    if (subscriptionFilter[key] == triggerFilter[key]) continue

    if (Array.isArray(triggerFilter[key]) && Array.isArray(subscriptionFilter[key])) {
      if (JSON.stringify(triggerFilter[key]) == JSON.stringify(subscriptionFilter[key])) {
        continue
      }
    }

    return false
  }

  return true
}

interface Subscription<F, D, TD> {
  filter: F
  sessions: RpcSession[]
  trigger(suppliedData: TD): void
}

/**
 * 1. Set name on topics
 * 2. Bind this to remote methods
 */
export function prepareLocal(services, prefix = "", visited: Set<unknown> = new Set()) {
  if (visited.has(services)) return
  visited.add(services)

  const keys = getObjectProps(services)

  keys.forEach(key => {
    const item = services[key]

    if (item && typeof item == "object") {
      const name = prefix + key

      if ("setTopicName" in item) {
        item.setTopicName(name)
        return
      }

      return prepareLocal(item, name + "/", visited)
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
