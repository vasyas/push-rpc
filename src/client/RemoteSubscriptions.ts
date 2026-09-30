import {safeStringify} from "../utils/json.js"

import type {SubscriptionOwnership} from "../rpc.js"

import {ClientCache} from "./index"

export class RemoteSubscriptions {
  constructor(private cache: ClientCache | null) {}

  unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void): boolean {
    const parametersKey = getParametersKey(parameters)

    return this.removeSubscription(itemName, parametersKey, consumer)
  }

  /** Add subscription in pending state */
  addSubscription(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
    const itemSubscriptions = this.byItem.get(itemName) || {byParameters: new Map()}
    this.byItem.set(itemName, itemSubscriptions)

    const parametersKey = getParametersKey(parameters)
    const parameterSubscriptions: ParametersSubscription = itemSubscriptions.byParameters.get(
      parametersKey,
    ) || {
      parameters,
      lifetime: ++this.lifetimeSequence,
      cached: undefined,
      consumers: [],
      queue: [],
    }

    itemSubscriptions.byParameters.set(parametersKey, parameterSubscriptions)
    parameterSubscriptions.consumers.push({
      consumer,
    })
  }

  /** A newer snapshot request supersedes pending replies for this subscription. */
  beginRequest(itemName: string, parameters: unknown[]) {
    const subscription = this.getFilterSubscriptions(itemName, parameters)
    if (!subscription) {
      return {
        bindConnection: (_epoch: string): SubscriptionOwnership | undefined => undefined,
        isCurrent: () => false,
        hasPendingSnapshot: () => false,
        deliver: (_data: unknown) => false,
        finish: (_error?: unknown) => {},
        wait: async () => {},
      }
    }

    let resolveDone = () => {}
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve
    })
    const request: SnapshotRequest = {
      done,
      pending: true,
      finish: (error?: unknown) => {
        if (!request.pending) return
        request.pending = false
        request.error = error
        resolveDone()
      },
    }
    const previous = subscription.request
    subscription.request = request
    previous?.finish()
    subscription.paused = true
    subscription.queue = []

    // `parameters` is the caller's array and may hold objects the application mutates,
    // so ownership is only ever true for the registration these parameters resolve to
    // right now. Re-checked before every write, never cached across a consumer callback.
    const owns = () =>
      this.getFilterSubscriptions(itemName, parameters) === subscription &&
      subscription.request === request

    return {
      bindConnection: (epoch: string): SubscriptionOwnership | undefined => {
        if (!owns()) return
        subscription.connectionEpoch = epoch
        return {epoch, lifetime: subscription.lifetime}
      },
      isCurrent: owns,
      hasPendingSnapshot: () =>
        this.getFilterSubscriptions(itemName, parameters) === subscription &&
        subscription.request?.pending === true,
      /**
       * Apply a snapshot, and report whether it was applied.
       *
       * publish() runs consumer callbacks, which may unsubscribe, mutate the
       * parameters object, or start a newer request. Ownership is therefore
       * rechecked before each queued item: nothing is written under a key that now
       * resolves elsewhere, and a newer request keeps the queue it just started.
       */
      deliver: (data: unknown) => {
        if (!owns()) return false

        subscription.paused = false
        this.publish(itemName, parameters, subscription, data)
        while (owns() && subscription.queue.length) {
          this.publish(itemName, parameters, subscription, subscription.queue.shift()!)
        }
        return true
      },
      finish: request.finish,
      wait: async () => {
        while (this.getFilterSubscriptions(itemName, parameters) === subscription) {
          const current = subscription.request!
          await current.done
          if (this.getFilterSubscriptions(itemName, parameters) !== subscription) return
          // Superseding a request wakes its waiters; they must follow the replacement.
          if (subscription.request !== current) continue
          if (current.error !== undefined) throw current.error
          return
        }
      },
    }
  }

  unpause(itemName: string, parameters: unknown[]) {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return

    filterSubscriptions.paused = false
  }

  flushQueue(itemName: string, parameters: unknown[]) {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return

    filterSubscriptions.queue.forEach((data) =>
      this.publish(itemName, parameters, filterSubscriptions, data),
    )

    filterSubscriptions.queue = []
  }

  emptyQueue(itemName: string, parameters: unknown[]) {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return

    filterSubscriptions.queue = []
  }

  private removeSubscription(
    itemName: string,
    parametersKey: string,
    consumer: (d: unknown) => void,
  ): boolean {
    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return false

    const filterSubscriptions = itemSubscriptions.byParameters.get(parametersKey)
    if (!filterSubscriptions) return false

    const index = filterSubscriptions.consumers.findIndex((c) => c.consumer == consumer)
    if (index == -1) return false

    filterSubscriptions.consumers.splice(index, 1)

    if (!filterSubscriptions.consumers.length) {
      filterSubscriptions.request?.finish()
      // Queued recovery tasks and request handles still reference this object;
      // release the payloads it holds so they are not retained until those settle.
      filterSubscriptions.cached = undefined
      filterSubscriptions.queue = []
      itemSubscriptions.byParameters.delete(parametersKey)

      if (itemSubscriptions.byParameters.size == 0) {
        this.byItem.delete(itemName)
      }

      return true
    }

    return false
  }

  getOwnership(itemName: string, parameters: unknown[]): SubscriptionOwnership | undefined {
    const subscription = this.getFilterSubscriptions(itemName, parameters)
    if (!subscription?.connectionEpoch) return
    return {epoch: subscription.connectionEpoch, lifetime: subscription.lifetime}
  }

  getCached(itemName: string, parameters: unknown[]): unknown | undefined {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return this.cache?.get(itemName, parameters)

    return filterSubscriptions.cached
  }

  consume(itemName: string, parameters: unknown[], data: unknown) {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return

    if (filterSubscriptions.paused) {
      filterSubscriptions.queue.push(data)
    } else {
      this.publish(itemName, parameters, filterSubscriptions, data)
    }
  }

  /** Cache and hand one value to the consumers of an already-resolved subscription. */
  private publish(
    itemName: string,
    parameters: unknown[],
    subscription: ParametersSubscription,
    data: unknown,
  ) {
    if (this.cache) this.cache.put(itemName, parameters, data)
    subscription.cached = data
    subscription.consumers.forEach((consumer) => {
      consumer.consumer(data)
    })
  }

  getConsumerSubscription(
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
  ): ConsumerSubscription | undefined {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    return (filterSubscriptions?.consumers || []).find((c) => c.consumer == consumer)
  }

  getAllSubscriptions(): Array<
    [itemName: string, parameters: unknown[], consumers: Array<(d: unknown) => void>]
  > {
    const result: Array<[string, unknown[], Array<(d: unknown) => void>]> = []

    for (const [itemName, itemSubscriptions] of this.byItem) {
      for (const [, parameterSubscriptions] of itemSubscriptions.byParameters) {
        const consumers = parameterSubscriptions.consumers.map((c) => c.consumer)

        if (consumers.length) {
          result.push([itemName, parameterSubscriptions.parameters, consumers])
        }
      }
    }

    return result
  }

  /** Recovery only needs the keys; skip building the consumer arrays. */
  getSubscriptionKeys(): Array<[itemName: string, parameters: unknown[]]> {
    const result: Array<[string, unknown[]]> = []

    for (const [itemName, itemSubscriptions] of this.byItem) {
      for (const [, parameterSubscriptions] of itemSubscriptions.byParameters) {
        if (parameterSubscriptions.consumers.length) {
          result.push([itemName, parameterSubscriptions.parameters])
        }
      }
    }

    return result
  }

  private getFilterSubscriptions(
    itemName: string,
    parameters: unknown[],
  ): ParametersSubscription | undefined {
    const parametersKey = getParametersKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byParameters.get(parametersKey)
    if (!filterSubscriptions) return

    return filterSubscriptions
  }

  private lifetimeSequence = 0
  private byItem: Map<string, ItemSubscription> = new Map()
}

type ItemSubscription = {
  byParameters: Map<string, ParametersSubscription>
}

type ParametersSubscription = {
  lifetime: number
  connectionEpoch?: string
  request?: SnapshotRequest
  parameters: unknown[]
  cached: unknown
  consumers: ConsumerSubscription[]

  paused: boolean
  queue: unknown[]
}

type ConsumerSubscription = {
  consumer: (d: unknown) => void
}

type SnapshotRequest = {
  done: Promise<void>
  pending: boolean
  finish: (error?: unknown) => void
  error?: unknown
}

function getParametersKey(parameters: unknown[]) {
  return safeStringify(parameters)
}
