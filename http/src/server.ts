import {Socket, MessageType} from "@push-rpc/core"
import {log} from "@push-rpc/core/dist/logger"
import {createMessageId} from "@push-rpc/core/dist/utils"

export interface HttpServerOptions {
  prefix: string
}

const defaultOptions: HttpServerOptions = {
  prefix: "",
}

export function createHttpKoaMiddleware(
  getRemoteId: (ctx) => string,
  opts: Partial<HttpServerOptions> = {}
): {onError; onConnection; middleware} {
  opts = {
    ...defaultOptions,
    ...opts,
  }

  let handleError = (e: any) => {}
  let handleConnection = async (socket: Socket, ...transportDetails: any) => {}
  let isConnected = (remoteId: string) => false

  const sockets: {[remoteId: string]: HttpServerSocket} = {}

  async function middleware(ctx) {
    const remoteId = getRemoteId(ctx)

    if (!isConnected(remoteId)) {
      const socket = new HttpServerSocket(() => delete sockets[remoteId])
      await handleConnection(socket, ctx)
      sockets[remoteId] = socket
    }

    const socket = sockets[remoteId]

    let prefix = opts.prefix ? opts.prefix : "/"
    if (!prefix.startsWith("/")) prefix = "/" + opts.prefix
    const prefixStripped = ctx.request.path.substring(prefix.length)
    const name = prefixStripped.startsWith("/") ? prefixStripped.substring(1) : prefixStripped

    let messageType = MessageType.Call // POST and others HTTP methods
    if (ctx.method == "PUT") messageType = MessageType.Get
    if (ctx.method == "PATCH") messageType = MessageType.Subscribe

    const {body, status, responseMessage} = await socket.invoke(messageType, name, ctx.request.body)

    ctx.response.status = status
    if (responseMessage) {
      ctx.response.message = responseMessage
    }

    ctx.body = body
  }

  return {
    onError(h) {
      handleError = h
    },
    onConnection(h, isConn) {
      handleConnection = h
      isConnected = isConn
    },
    middleware,
  }
}

class HttpServerSocket implements Socket {
  constructor(private clean: () => void) {}

  private sendMessage: (string) => void
  private handleClose = (code, reason) => {}

  // Timeout expiration is not a big issue here, b/c these are the local calls, and RpcSession impl is robust in implementing local calls
  private calls: {[id: string]: (r: {body; status; responseMessage}) => void} = {}

  invoke(
    type: MessageType.Call | MessageType.Subscribe | MessageType.Get,
    name: string,
    params: any
  ): Promise<{status; body; responseMessage}> {
    const id = createMessageId()
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
  onPing(h: () => void) {}

  terminate() {
    this.clean()
    this.handleClose("forced", null)
  }

  send(data: string) {
    const [type, id, ...other] = JSON.parse(data)

    let status = 204
    let body = null
    let responseMessage = undefined

    if (type == MessageType.Error) {
      const [code, description, details] = other

      responseMessage = description
      body = details
      status = code || 500
    } else if (type == MessageType.Data) {
      const [name, params, data] = other
      body = data
      status = 200
    } else if (type == MessageType.Result) {
      const [res] = other
      body = res
      status = 200
    } else {
      log.warn("Unexpected message type " + type)
    }

    if (this.calls[id]) {
      this.calls[id]({status, body, responseMessage})
      delete this.calls[id]
    }
  }

  ping(data: string) {}
}
