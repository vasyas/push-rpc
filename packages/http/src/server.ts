import {Socket, MessageType} from "@push-rpc/core"
import {log} from "@push-rpc/core/dist/logger"
import {createMessageId} from "@push-rpc/core/dist/utils"

export function createKoaHttpMiddleware(
  getRemoteId: (ctx) => string,
): {onError; onConnection; middleware} {
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

    const {path} = ctx.request
    const name = path.startsWith("/") ? path.substring(1) : path

    let messageType = MessageType.Call // POST and others HTTP methods
    if (ctx.method == "PUT") messageType = MessageType.Get
    if (ctx.method == "PATCH") messageType = MessageType.Subscribe

    const {body, status} = await socket.invoke(messageType, name, ctx.request.body)

    ctx.response.status = status
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

export function createExpressHttpMiddleware(
  getRemoteId: (ctx) => string
): {onError; onConnection; middleware} {
  let handleError = (e: any) => {}
  let handleConnection = async (socket: Socket, ...transportDetails: any) => {}
  let isConnected = (remoteId: string) => false

  const sockets: {[remoteId: string]: HttpServerSocket} = {}

  async function middleware(request, response, next) {
    const remoteId = getRemoteId(request)

    if (!isConnected(remoteId)) {
      const socket = new HttpServerSocket(() => delete sockets[remoteId])
      await handleConnection(socket, request, response)
      sockets[remoteId] = socket
    }

    const socket = sockets[remoteId]

    const prefixStripped = request.path
    const name = prefixStripped.startsWith("/") ? prefixStripped.substring(1) : prefixStripped

    let messageType = MessageType.Call // POST and others HTTP methods
    if (request.method == "PUT") messageType = MessageType.Get
    if (request.method == "PATCH") messageType = MessageType.Subscribe

    const {body, status} = await socket.invoke(messageType, name, request.body)

    response
      .status(status)
      .send(body)
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
  private calls: {[id: string]: (r: {body; status}) => void} = {}

  invoke(
    type: MessageType.Call | MessageType.Subscribe | MessageType.Get,
    name: string,
    params: any
  ): Promise<{status; body}> {
    const id = createMessageId()
    const message = [type, id, name, params]

    return new Promise(resolve => {
      this.calls[id] = resolve
      setTimeout(() => {
        try {
          this.sendMessage(JSON.stringify(message))
        } catch (e) { // should not happen, report just in case
          log.error("Unhandled error from RPC session", e)
        }
      }, 0)
    })
  }

  onMessage(h: (message: string) => void) {
    this.sendMessage = h
  }

  onOpen(h: () => void) {
    setTimeout(h, 0)
  }

  onDisconnected(h: (code, reason) => void) {
    this.handleClose = h
  }

  onError(h: (e) => void) {}
  onPong(h: () => void) {}
  onPing(h: () => void) {}

  disconnect() {
    this.clean()
    this.handleClose("forced", null)
  }

  send(data: string) {
    const [type, id, ...other] = JSON.parse(data)

    let status = 204
    let body = null

    if (type == MessageType.Error) {
      const [code, description, details] = other

      body = details || description
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
      this.calls[id]({status, body})
      delete this.calls[id]
    }
  }

  ping(data: string) {}
}
