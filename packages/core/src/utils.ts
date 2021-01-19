export const ITEM_NAME_SEPARATOR = "/"

export function dateToIsoString(d: Date): string {
  const s = d.toISOString()

  return s.substring(0, s.lastIndexOf(".")) + "Z"
}

export function getClassMethodNames(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
    .filter(m => obj[m] instanceof Function)
    .filter(m => obj[m].name != "constructor")
}

export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return function(ctx, next, params, messageType) {
    let index = -1
    return dispatch(0, params)

    function dispatch(i, p) {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"))

      index = i

      try {
        if (i === middleware.length) {
          return Promise.resolve(next(p))
        } else {
          return Promise.resolve(middleware[i](ctx, dispatch.bind(null, i + 1), p, messageType))
        }
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

export enum InvocationType {
  Call = "Call",
  Get = "Get",
  Subscribe = "Subscribe",
  Unsubscribe = "Unsubscribe",
}

export type Middleware = (
  ctx: any,
  next: (params: any) => Promise<any>,
  params: any,
  invocationType: InvocationType
) => Promise<any>
