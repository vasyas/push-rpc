import {Consumer, RemoteFunction, Services} from "../rpc.js"

export function createRemote<S extends Services>(
  hooks: RemoteHooks,
  name = ""
): ServicesWithSubscriptions<S> {
  // TODO add remote middleware?

  // start with method
  const remoteItem = (...params: unknown[]) => {
    return hooks.call(name, params)
  }

  // add subscription methods
  const subscription = {
    subscribe: (consumer: (d: unknown) => void, ...args: unknown[]) =>
      hooks.subscribe(name, args, consumer),
    unsubscribe: (consumer: (d: unknown) => void, ...args: unknown[]) =>
      hooks.unsubscribe(name, args, consumer),
  }

  Object.assign(remoteItem, subscription)

  // then add proxy creating subitems

  const cachedItems: any = {}

  return new Proxy(remoteItem, {
    get(target: any, propName: any) {
      // skip internal props
      if (typeof propName != "string") return target[propName]

      // skip other system props
      if (["then", "catch", "toJSON", ...skippedRemoteProps].includes(propName))
        return target[propName]

      // skip subscription methods
      if (Object.keys(subscription).includes(propName)) return target[propName]

      if (!cachedItems[propName]) {
        cachedItems[propName] = createRemote(
          hooks,
          name ? name + "/" + propName : propName
        )
      }

      return cachedItems[propName]
    },

    set(target, propName, value) {
      cachedItems[propName] = value
      return true
    },

    // Used in resubscribe
    ownKeys() {
      return [...skippedRemoteProps, ...Object.keys(cachedItems)]
    },
  })
}

export type RemoteHooks = {
  call(itemName: string, parameters: unknown[]): Promise<unknown>
  subscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void): Promise<void>
  unsubscribe(itemName: string, parameters: unknown[], consumer: (d: unknown) => void): Promise<void>
}

export type ServicesWithSubscriptions<T extends Services> = {
  [K in keyof T]: T[K] extends Services
    ? ServicesWithSubscriptions<T[K]>
    : T[K] extends RemoteFunction
      ? T[K] & {
                  subscribe(consumer: Consumer<T[K]>, ...parameters: Parameters<T[K]>): Promise<void>,
                  unsubscribe(consumer: Consumer<T[K]>, ...parameters: Parameters<T[K]>): Promise<void>
              }
      : never
}

const skippedRemoteProps = ["length", "name", "prototype", "arguments", "caller"]
