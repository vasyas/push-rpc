import {RemoteFunction, RpcConnectionContext, Services} from "../rpc.js"
import {ServerSubscriptions} from "./ServerSubscriptions"
import {ExtractPromiseResult} from "../utils/types.js"
import {ThrottleArgsReducer} from "../utils/throttle.js"
import EventEmitter from "node:events"

export const eventEmitterSymbol = Symbol("eventEmitter")

export type ThrottleSettings<D> = {
  timeout: number
  reducer?: ThrottleArgsReducer<D>
}

export function prepareImplementation<T extends Services<T>>(
  serverSubscriptions: ServerSubscriptions,
  services: T,
  name = "",
): ServicesImplementation<T> {
  const cachedItems: any = {}
  const skippedProps = ["length", "name", "prototype", "arguments", "caller"]

  return new Proxy(services, {
    get(target: any, propName: string) {
      // skip internal props
      if (typeof propName != "string") return target[propName]

      // skip other system props
      if (["then", "catch", "toJSON", ...skippedProps].includes(propName)) return target[propName]

      const itemName = name ? name + "/" + propName : propName

      if (typeof target[propName] == "function") {
        const delegate = (...params: unknown[]) => {
          return target[propName](...params)
        }

        // bind eventEmitter to source services, so it can be looked up from getRemoteFunction
        target[propName][eventEmitterSymbol] =
          target[propName][eventEmitterSymbol] ?? new EventEmitter()

        delegate.trigger = (filter: Record<string, unknown> = {}, suppliedData?: unknown) => {
          // triggers are delayed for consumers to receive updates after the current call ends.
          setTimeout(() => {
            serverSubscriptions.trigger(itemName, filter, suppliedData)
          }, 0)
        }

        delegate.throttle = (settings: ThrottleSettings<unknown>) => {
          serverSubscriptions.throttleItem(itemName, settings)
        }

        delegate.addEventListener = (eventName: string, listener: (event: unknown) => void) => {
          target[propName][eventEmitterSymbol].addListener(eventName, listener)
        }

        delegate.removeEventListener = (eventName: string, listener: (event: unknown) => void) => {
          target[propName][eventEmitterSymbol].removeListener(eventName, listener)
        }

        return delegate
      } else if (!cachedItems[propName]) {
        cachedItems[propName] = prepareImplementation(
          serverSubscriptions,
          services[propName as keyof T] as any,
          itemName,
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

export type SubscribeEvent<F extends RemoteFunction> = {
  itemName: string
  filter: Parameters<F>[0]
  clientId: string
  context: RpcConnectionContext
}

// UnsubscribeEVent cannot contain ctx b/c ctx won't be available in case of disconnecting entire client
export type UnsubscribeEvent<F extends RemoteFunction> = {
  itemName: string
  filter: Parameters<F>[0]
  clientId: string
}

export type FunctionImplementation<F extends RemoteFunction> = {
  trigger(
    filter?: Partial<Parameters<F>[0]>,
    suppliedData?: ExtractPromiseResult<ReturnType<F>>,
  ): void
  throttle(settings: ThrottleSettings<ExtractPromiseResult<ReturnType<F>>>): void

  addEventListener(event: "subscribe", listener: (event: SubscribeEvent<F>) => void): void
  addEventListener(event: "unsubscribe", listener: (event: UnsubscribeEvent<F>) => void): void
  removeEventListener(event: "subscribe", listener: (event: SubscribeEvent<F>) => void): void
  removeEventListener(event: "unsubscribe", listener: (event: UnsubscribeEvent<F>) => void): void
}

export type ServicesImplementation<T extends Services<T>> = {
  [K in keyof T]: T[K] extends RemoteFunction
    ? T[K] & FunctionImplementation<T[K]>
    : T[K] extends object
      ? ServicesImplementation<T[K]>
      : never
}
