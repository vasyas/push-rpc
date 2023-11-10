import {SocketServer} from "@push-rpc/core"
import Koa from "koa"
import koaBody from "koa-body"
import {createKoaHttpMiddleware} from "./server"

export function createKoaHttpServer(
  port: number,
  getRemoteId: (ctx: Koa.Context) => string
): SocketServer {
  const {onError, onConnection, middleware} = createKoaHttpMiddleware(getRemoteId)

  const app = new Koa()
  app.use(koaBody({multipart: true}))
  app.use(middleware)
  const server = app.listen(port)

  return {
    onError,
    onConnection,
    close(cb) {
      server.close(cb)
    },
  }
}
