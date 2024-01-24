import {RemoteFunction, Services} from "../rpc.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import {ExtractPromiseResult} from "../utils/types.js"
import {ThrottleArgsReducer} from "../utils/throttle.js"

export type ServicesWithTriggers<T extends Services> = {
  [K in keyof T]: T[K] extends Services
    ? ServicesWithTriggers<T[K]>
    : T[K] extends RemoteFunction
      ? T[K] & {
          trigger(
            filter?: Partial<Parameters<T[K]>[0]>,
            suppliedData?: ExtractPromiseResult<ReturnType<T[K]>>
          ): void
          throttle(settings: ThrottleSettings): void
        }
      : never
}

export type ThrottleSettings = {
  timeout: number
  reducer?: ThrottleArgsReducer<unknown>
}

export function withTriggers<T extends Services>(
  localSubscriptions: LocalSubscriptions,
  services: Services,
  name = ""
): ServicesWithTriggers<T> {
  const cachedItems: any = {}
  const skippedProps = ["length", "name", "prototype", "arguments", "caller"]

  return new Proxy(services, {
    get(target: any, propName: any) {
      // skip internal props
      if (typeof propName != "string") return target[propName]

      // skip other system props
      if (["then", "catch", "toJSON", ...skippedProps].includes(propName)) return target[propName]

      const itemName = name ? name + "/" + propName : propName

      if (typeof target[propName] == "function") {
        const delegate = (...params: unknown[]) => {
          return target[propName](...params)
        }

        delegate.trigger = (filter: Record<string, unknown> = {}, suppliedData?: unknown) => {
          // triggers are delayed for consumers to receive updates after the current call ends.
          setTimeout(() => {
            localSubscriptions.trigger(itemName, filter, suppliedData)
          }, 0)
        }

        delegate.throttle = (settings: ThrottleSettings) => {
          localSubscriptions.throttleItem(itemName, settings)
        }

        return delegate
      } else if (!cachedItems[propName]) {
        cachedItems[propName] = withTriggers(
          localSubscriptions,
          services[propName] as Services,
          itemName
        )
      }

      return cachedItems[propName]
    },

    set(target, propName, value) {
      cachedItems[propName] = value
      return true
    },

    ownKeys() {
      return [...skippedProps, ...Object.keys(cachedItems)]
    },
  })
}
