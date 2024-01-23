import {safeStringify} from "../utils/json.js"

export class RemoteSubscriptions {
  subscribe(
    initialData: unknown,
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ) {
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

    const filterSubscriptions = itemSubscriptions.byFilter.get(filterKey) || {
      cached: null,
      consumers: [],
    }
    itemSubscriptions.byFilter.set(filterKey, filterSubscriptions)
    filterSubscriptions.consumers.push(consumer)
  }

  private removeSubscription(itemName: string, filterKey: string, consumer: (d: unknown) => void) {
    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byFilter.get(filterKey)
    if (!filterSubscriptions) return

    filterSubscriptions.consumers = filterSubscriptions.consumers.filter((c) => c != consumer)

    if (!filterSubscriptions.consumers.length) {
      itemSubscriptions.byFilter.delete(filterKey)

      if (itemSubscriptions.byFilter.size == 0) {
        this.byItem.delete(itemName)
      }
    }
  }

  getCached(itemName: string, parameters: unknown[]): unknown | undefined {
    const filterKey = getFilterKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byFilter.get(filterKey)

    return filterSubscriptions?.cached
  }

  consume(itemName: string, parameters: unknown[], data: unknown) {
    const filterKey = getFilterKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byFilter.get(filterKey)

    if (!filterSubscriptions) return

    filterSubscriptions.cached = data
    filterSubscriptions.consumers.forEach((consumer) => {
      consumer(data)
    })
  }

  private byItem: Map<string, ItemSubscription> = new Map()
}

type ItemSubscription = {
  byFilter: Map<
    string,
    {
      cached: unknown
      consumers: Array<(d: unknown) => void>
    }
  >
}

function getFilterKey(parameters: unknown[]) {
  return safeStringify(parameters?.[0] ?? null)
}
