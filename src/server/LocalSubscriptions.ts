import {safeStringify} from "../utils/json.js"

export class LocalSubscriptions {
  subscribe(subscriptionKey: string, itemName: string, parameters: unknown[], update: () => void) {
    const itemSubscriptions = this.byItem.get(itemName) || {byFilter: new Map()}
    this.byItem.set(itemName, itemSubscriptions)

    const filterKey = getFilterKey(parameters)

    const subscriptions: FilterSubscription = itemSubscriptions.byFilter.get(filterKey) || {
      filter: parameters?.[0],
      subscribedClients: [],
    }
    itemSubscriptions.byFilter.set(filterKey, subscriptions)

    if (!subscriptions.subscribedClients.some((c) => c.subscriptionKey == subscriptionKey)) {
      subscriptions.subscribedClients.push({subscriptionKey, update})
    }
  }

  unsubscribe(subscriptionKey: string, itemName: string, parameters: unknown[]) {
    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterKey = getFilterKey(parameters)

    const subscriptions = itemSubscriptions.byFilter.get(filterKey)
    if (!subscriptions) return

    subscriptions.subscribedClients = subscriptions.subscribedClients.filter(
      (subscription) => subscription.subscriptionKey != subscriptionKey
    )

    if (!subscriptions.subscribedClients.length) {
      itemSubscriptions.byFilter.delete(filterKey)

      if (itemSubscriptions.byFilter.size == 0) {
        this.byItem.delete(itemName)
      }
    }
  }

  trigger(itemName: string, triggerFilter: Record<string, unknown> = {}) {
    console.log("Trigger", itemName, triggerFilter)

    const itemSub = this.byItem.get(itemName)
    if (!itemSub) return

    for (const {filter: subscriptionFilter, subscribedClients} of itemSub.byFilter.values()) {
      if (!filterContains(triggerFilter, subscriptionFilter)) continue

      subscribedClients.forEach((subscribedClient) => {
        subscribedClient.update()
      })
    }
  }

  private byItem: Map<string, ItemSubscription> = new Map()
}

type ItemSubscription = {
  byFilter: Map<string, FilterSubscription>
}

type FilterSubscription = {
  filter: Record<string, unknown>
  subscribedClients: Array<SubscribedClient>
}

type SubscribedClient = {
  subscriptionKey: string
  update: () => void
}

function filterContains(
  triggerFilter: Record<string, unknown>,
  subscriptionFilter: Record<string, unknown>
): boolean {
  if (subscriptionFilter == null) return true // subscribe to all data
  if (triggerFilter == null) return true // all data modified

  for (const key of Object.keys(subscriptionFilter)) {
    if (triggerFilter[key] == undefined) continue
    if (subscriptionFilter[key] == triggerFilter[key]) continue

    if (Array.isArray(triggerFilter[key]) && Array.isArray(subscriptionFilter[key])) {
      if (safeStringify(triggerFilter[key]) == safeStringify(subscriptionFilter[key])) {
        continue
      }
    }

    return false
  }

  return true
}

function getFilterKey(parameters: unknown[]) {
  return safeStringify(parameters?.[0] ?? null)
}