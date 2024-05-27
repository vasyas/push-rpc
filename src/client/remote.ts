import {CallOptions, Consumer, RemoteFunction, Services} from "../rpc.js"

export function createRemote<S extends Services<S>>(
  hooks: RemoteHooks,
  name = "",
): ServicesWithSubscriptions<S> {
  // start with remote function
  const remoteItem = (...paramsWithCallOptions: unknown[]) => {
    const {params, callOptions} = extractCallOptions(paramsWithCallOptions)

    return hooks.call(name, params, callOptions)
  }

  // add subscription methods
  const subscription = {
    subscribe: (consumer: (d: unknown) => void, ...paramsWithCallOptions: unknown[]) => {
      const {params, callOptions} = extractCallOptions(paramsWithCallOptions)
      return hooks.subscribe(name, params, consumer, callOptions)
    },
    unsubscribe: (consumer: (d: unknown) => void, ...paramsWithCallOptions: unknown[]) => {
      const {params, callOptions} = extractCallOptions(paramsWithCallOptions)
      return hooks.unsubscribe(name, params, consumer, callOptions)
    },
    itemName: name,
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
        cachedItems[propName] = createRemote(hooks, name ? name + "/" + propName : propName)
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

function extractCallOptions(params: unknown[]): {params: unknown[]; callOptions?: CallOptions} {
  if (
    params.length > 0 &&
    typeof params[params.length - 1] == "object" &&
    params[params.length - 1] != null &&
    (params[params.length - 1] as any).kind == CallOptions.KIND
  ) {
    const options = params.pop() as CallOptions
    return {
      params,
      callOptions: options,
    }
  }

  return {params}
}

export type RemoteHooks = {
  call(itemName: string, parameters: unknown[], callOptions?: CallOptions): Promise<unknown>
  subscribe(
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions,
  ): Promise<void>
  unsubscribe(
    itemName: string,
    parameters: unknown[],
    consumer: (d: unknown) => void,
    callOptions?: CallOptions,
  ): Promise<void>
}

export type AddParameters<
  TFunction extends (...args: any) => any,
  TParameters extends [...args: any],
> = (...args: [...Parameters<TFunction>, ...TParameters]) => ReturnType<TFunction>

export type ServicesWithSubscriptions<T extends Services<T>> = {
  [K in keyof T]: T[K] extends RemoteFunction
    ? AddParameters<T[K], [CallOptions?]> & {
    subscribe(
      consumer: Consumer<T[K]>,
      ...parameters: [...Parameters<T[K]>, CallOptions?]
    ): Promise<void>
    unsubscribe(
      consumer: Consumer<T[K]>,
      ...parameters: [...Parameters<T[K]>, CallOptions?]
    ): Promise<void>
  }
    : T[K] extends object
      ? ServicesWithSubscriptions<T[K]>
      : never
}

const skippedRemoteProps = ["length", "name", "prototype", "arguments", "caller"]
