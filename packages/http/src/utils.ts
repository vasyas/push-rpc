import * as Koa from "koa"
import * as koaBody from "koa-body"
import {SocketServer} from "@push-rpc/core"
import {createKoaHttpMiddleware, HttpServerOptions} from "./server"

export function createKoaHttpServer(
  port: number,
  getRemoteId: (ctx: Koa.Context) => string,
  opts: Partial<HttpServerOptions> = {}
): SocketServer {
  const {onError, onConnection, middleware} = createKoaHttpMiddleware(getRemoteId, opts)

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
