import {safeStringify} from "../utils/json.js"

export class RemoteSubscriptions {
  subscribe(
    initialData: unknown,
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void
  ) {
    this.addSubscription(itemName, parameters, consumer)

    this.consume(itemName, parameters, initialData)
  }

  unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
    const parametersKey = getParametersKey(parameters)

    this.removeSubscription(itemName, parametersKey, consumer)
  }

  private addSubscription(itemName: string, parameters: unknown[], consumer: (d: unknown) => void) {
    const itemSubscriptions = this.byItem.get(itemName) || {byParameters: new Map()}
    this.byItem.set(itemName, itemSubscriptions)

    const parametersKey = getParametersKey(parameters)
    const parameterSubscriptions = itemSubscriptions.byParameters.get(parametersKey) || {
      parameters,
      cached: null,
      consumers: [],
    }
    itemSubscriptions.byParameters.set(parametersKey, parameterSubscriptions)
    parameterSubscriptions.consumers.push(consumer)
  }

  private removeSubscription(
    itemName: string,
    parametersKey: string,
    consumer: (d: unknown) => void
  ) {
    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byParameters.get(parametersKey)
    if (!filterSubscriptions) return

    filterSubscriptions.consumers = filterSubscriptions.consumers.filter((c) => c != consumer)

    if (!filterSubscriptions.consumers.length) {
      itemSubscriptions.byParameters.delete(parametersKey)

      if (itemSubscriptions.byParameters.size == 0) {
        this.byItem.delete(itemName)
      }
    }
  }

  getCached(itemName: string, parameters: unknown[]): unknown | undefined {
    const parametersKey = getParametersKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byParameters.get(parametersKey)

    return filterSubscriptions?.cached
  }

  consume(itemName: string, parameters: unknown[], data: unknown) {
    const parametersKey = getParametersKey(parameters)

    const itemSubscriptions = this.byItem.get(itemName)
    if (!itemSubscriptions) return

    const filterSubscriptions = itemSubscriptions.byParameters.get(parametersKey)

    if (!filterSubscriptions) return

    filterSubscriptions.cached = data
    filterSubscriptions.consumers.forEach((consumer) => {
      consumer(data)
    })
  }

  getAllSubscriptions(): Array<[string, unknown[], Array<(d: unknown) => void>]> {}

  private byItem: Map<string, ItemSubscription> = new Map()

  // test-only replace with getAllSubscriptions?
  _subscriptions() {
    return this.byItem
  }
}

type ItemSubscription = {
  byParameters: Map<
    string,
    {
      parameters: unknown[]
      cached: unknown
      consumers: Array<(d: unknown) => void>
    }
  >
}

function getParametersKey(parameters: unknown[]) {
  return safeStringify(parameters)
}
