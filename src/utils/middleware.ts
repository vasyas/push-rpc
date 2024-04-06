export type Middleware<Context> = (
  ctx: Context,
  next: (...params: unknown[]) => Promise<unknown>,
  ...params: unknown[]
) => Promise<unknown>

export function withMiddlewares<Context>(
  ctx: Context,
  middlewares: Middleware<Context>[],
  final: (...params: unknown[]) => Promise<unknown>,
  ...params: any
) {
  return (function (next, ...params) {
    let index = -1
    return dispatch(0, ...params)

    function dispatch(i: number, ...p: unknown[]): Promise<unknown> {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"))

      // use previous invocation params
      if (!p.length) {
        p = params
      }

      index = i

      try {
        let result

        if (i === middlewares.length) {
          result = next(...p)
        } else {
          const dispatchNextMiddleware = dispatch.bind(null, i + 1)
          result = middlewares[i](ctx, dispatchNextMiddleware, ...p)
        }

        return Promise.resolve(result)
      } catch (err) {
        return Promise.reject(err)
      }
    }
  })(final, ...params)
}
