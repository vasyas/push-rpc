import {safeStringify} from "../utils/json.js"

export class RemoteSubscriptions {
  constructor() {}

  subscribe(initialData: unknown, itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
    const filterKey = getFilterKey(parameters)

    this.addSubscription(itemName, filterKey, consumer)

    this.consume(itemName, parameters, initialData)
  }

  unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
    const filterKey = getFilterKey(parameters)

    this.removeSubscription(itemName, filterKey, consumer)
  }

  private addSubscription(itemName: string, filterKey: string, consumer: (d: unknown) => void) {
    const itemSubscriptions = this.byItem.get(itemName) || {byFilter: new Map()}
    this.byItem.set(itemName, itemSubscriptions)

    const subscriptions = itemSubscriptions.byFilter.get(filterKey) || []
    itemSubscriptions.byFilter.set(filterKey, subscriptions)
    subscriptions.push({consumer})
  }

  private removeSubscription(itemName: string, filterKey: string, consumer: (d: unknown) => void) {
    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const subscriptions = itemSubscriptions.byFilter.get(filterKey)
    if (!subscriptions) return

    const newSubscriptions = subscriptions.filter(
      (subscription) => subscription.consumer != consumer
    )

    if (newSubscriptions.length > 0) itemSubscriptions.byFilter.set(filterKey, newSubscriptions)
    else {
      itemSubscriptions.byFilter.delete(filterKey)

      if (itemSubscriptions.byFilter.size == 0) {
        this.byItem.delete(itemName)
      }
    }
  }

  consume(itemName: string, parameters: unknown[], data: unknown) {
    const filterKey = getFilterKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const subscriptions = itemSubscriptions.byFilter.get(filterKey) || []
    subscriptions.forEach((subscription) => {
      subscription.consumer(data)
    })
  }

  private byItem: Map<string, ItemSubscription> = new Map()
}

type ItemSubscription = {
  byFilter: Map<
    string,
    Array<{
      consumer: (d: unknown) => void
    }>
  >
}

function getFilterKey(parameters: unknown[]) {
  return safeStringify(parameters?.[0] ?? null)
}
