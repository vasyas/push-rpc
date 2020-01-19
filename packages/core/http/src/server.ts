import * as Koa from "koa"
import * as koaBody from "koa-body"
import {SocketServer} from "../../core/src"
import {Socket} from "../../core/src"

export function createHttpServer(port, prefix): SocketServer {
  let handleError = (e: any) => {}
  let handleConnection = (socket: Socket, transportDetails: any) => {}
  let isConnected = (remoteId: string) => true

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
    console.log("A", ctx)

    ctx.body = "Hello World"
  })

  const server = app.listen(port)

  return {
    onError(h) {
      handleError = h
    },
    onConnection(h, isConn) {
      handleConnection = h
      isConnected = isConn
    },
    close(cb) {
      server.close(cb)
    },
  }
}
