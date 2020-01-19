import * as Koa from "koa"
import * as koaBody from "koa-body"
import {Socket, SocketServer} from "../../core/src"
import * as UUID from "uuid-js"
import {MessageType} from "../../core/src/rpc"

export interface HttpServerOptions {
  prefix: string
}

const defaultOptions: HttpServerOptions = {
  prefix: "",
}

export function createHttpServer(
  port: number,
  getRemoteId: (ctx: Koa.Context) => string,
  opts: Partial<HttpServerOptions> = {}
): SocketServer {
  opts = {
    ...defaultOptions,
    ...opts,
  }

  let handleError = (e: any) => {}
  let handleConnection = (socket: Socket, transportDetails: any) => {}
  let isConnected = (remoteId: string) => false

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

  const sockets: {[remoteId: string]: HttpServerSocket} = {}

  app.use(async ctx => {
    const remoteId = getRemoteId(ctx)

    if (!isConnected(remoteId)) {
      sockets[remoteId] = new HttpServerSocket(() => delete sockets[remoteId])
      handleConnection(sockets[remoteId], ctx)
    }

    const socket = sockets[remoteId]

    if (!socket) {
      handleError(
        "Keep-alive period of HttpServerSocket should be > keep-alive period for RpcSession"
      )
    }

    const path = ctx.request.path
    const prefixStripped = opts.prefix ? path.substring(opts.prefix.length) : path
    const name = prefixStripped.startsWith("/") ? prefixStripped.substring(1) : prefixStripped

    let messageType = MessageType.Call // POST and others HTTP methods
    if (ctx.method == "PUT") messageType = MessageType.Get
    if (ctx.method == "PATCH") messageType = MessageType.Subscribe

    const {body, status} = await socket.invoke(messageType, name, ctx.request.body)

    ctx.response.status = status
    ctx.body = body
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

class HttpServerSocket implements Socket {
  constructor(private clean: () => void) {}

  private sendMessage: (string) => void
  private handleClose = (code, reason) => {}

  // TODO timeout!
  private calls: {[id: string]: (r: {body; status}) => void} = {}

  invoke(
    type: MessageType.Call | MessageType.Subscribe | MessageType.Get,
    name: string,
    params: any
  ): Promise<{status; body}> {
    const id = UUID.create().toString()
    const message = [type, id, name, params]

    return new Promise(resolve => {
      this.calls[id] = resolve
      setTimeout(() => {
        this.sendMessage(JSON.stringify(message))
      }, 0)
    })
  }

  onMessage(h: (message: string) => void) {
    this.sendMessage = h
  }

  onOpen(h: () => void) {
    setTimeout(h, 0)
  }

  onClose(h: (code, reason) => void) {
    this.handleClose = h
  }

  onError(h: (e) => void) {}
  onPong(h: () => void) {}

  terminate() {
    this.clean()
    this.handleClose("forced", null)
  }

  send(data: string) {
    const [type, id, ...other] = JSON.parse(data)

    let status = 204
    let body = null

    if (type == MessageType.Error) {
      const [code, description, details] = other
      body = details
      status = 400
    } else if (type == MessageType.Data) {
      const [name, params, data] = other
      body = data
      status = 200
    } else if (type == MessageType.Result) {
      const [res] = other
      body = res
      status = 200
    } else {
      // throw new Error("Unexpected message type " + type)
    }

    if (this.calls[id]) {
      this.calls[id]({status, body})
      delete this.calls[id]
    }
  }

  ping(data: string) {}
}
