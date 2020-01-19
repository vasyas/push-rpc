import Koa from "koa"
import koaBody from "koa-body"
import {SocketServer} from "@push-rpc/core"

export function createHttpServer(port, prefix): SocketServer {
  const app = new Koa()
  app.use(koaBody({multipart: true}))

  /*
  app.use(async (ctx, next) => {
    try {
      return await next()
    } catch (e) {
      if (e.httpStatus) {
        ctx.status = e.httpStatus
        ctx.body = e.body ? e.body : e.message
      } else {
        const msg = e instanceof Error ? e.message : "" + e

        ctx.status = 500
        ctx.body = msg
      }
    }
  })
   */

  app.use(async ctx => {
    ctx.body = "Hello World"
  })

  app.listen(port)

  return {
    onError: e => s.on("error", e),

    onConnection: h => {
      s.on("connection", socket => {
        h(wrapSocket(socket), socket)
      })
    },
    close: h => s.close(h),
  }
}
