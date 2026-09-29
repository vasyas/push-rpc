import {safeStringify} from "../utils/json.js"

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
      cached: undefined,
      consumers: [],
      queue: [],
    }

    itemSubscriptions.byParameters.set(parametersKey, parameterSubscriptions)
    parameterSubscriptions.consumers.push({
      consumer,
    })
  }

  pause(itemName: string, parameters: unknown[]) {
    const filterSubscriptions = this.getFilterSubscriptions(itemName, parameters)
    if (!filterSubscriptions) return

    filterSubscriptions.paused = true
  }

  /** A newer snapshot request supersedes pending replies for this subscription. */
  beginRequest(itemName: string, parameters: unknown[]) {
    const subscription = this.getFilterSubscriptions(itemName, parameters)
    if (!subscription) {
      return {
        isCurrent: () => false,
        hasPendingSnapshot: () => false,
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

    return {
      isCurrent: () =>
        this.getFilterSubscriptions(itemName, parameters) === subscription &&
        subscription.request === request,
      hasPendingSnapshot: () =>
        this.getFilterSubscriptions(itemName, parameters) === subscription &&
        subscription.request?.pending === true,
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

    filterSubscriptions.queue.forEach((data) => {
      if (this.cache) this.cache.put(itemName, parameters, data)
      filterSubscriptions.cached = data
      filterSubscriptions.consumers.forEach((consumer) => {
        consumer.consumer(data)
      })
    })

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
      itemSubscriptions.byParameters.delete(parametersKey)

      if (itemSubscriptions.byParameters.size == 0) {
        this.byItem.delete(itemName)
      }

      return true
    }

    return false
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
      if (this.cache) this.cache.put(itemName, parameters, data)
      filterSubscriptions.cached = data
      filterSubscriptions.consumers.forEach((consumer) => {
        consumer.consumer(data)
      })
    }
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

  private byItem: Map<string, ItemSubscription> = new Map()
}

type ItemSubscription = {
  byParameters: Map<string, ParametersSubscription>
}

type ParametersSubscription = {
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
