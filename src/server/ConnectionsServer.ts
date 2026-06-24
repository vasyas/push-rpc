import {safeStringify} from "../utils/json.js"
import WebSocket, {WebSocketServer} from "ws"
import http from "http"
import {log} from "../logger.js"
import {PING_MSG, RpcConnectionContext} from "../rpc.js"

export class ConnectionsServer {
  constructor(
    server: http.Server,
    options: ConnectionsServerOptions,
    connectionClosed: (clientId: string) => void,
    closeSocketsWithDifferentPath: boolean,
    createConnectionContext: (req: http.IncomingMessage) => Promise<RpcConnectionContext>,
  ) {
    this.wss = new WebSocketServer({noServer: true})

    server.on("upgrade", (request, socket, head) => {
      if (!request.url?.startsWith(options.path)) {
        if (closeSocketsWithDifferentPath) {
          socket.destroy()
        }
        return
      }

      // Give the application a chance to authenticate/authorize the upgrade and
      // establish the connection context. Throwing rejects the upgrade.
      createConnectionContext(request).then(
        (ctx) => {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            ;(ws as WebSocket & {rpcContext: RpcConnectionContext}).rpcContext = ctx
            this.wss.emit("connection", ws, request)
          })
        },
        (e) => {
          log.warn("WebSocket upgrade rejected", e)
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n")
          socket.destroy()
        },
      )
    })

    this.wss.on(
      "connection",
      (ws: WebSocket & {alive: boolean; rpcContext?: RpcConnectionContext}) => {
        ws.alive = true

        const clientId = ws.rpcContext?.clientId || "anon"
        this.clientSockets.set(clientId, ws)

        ws.on("error", (e: unknown) => {
          log.error("Error in WS", e)
        })

        ws.on("close", () => {
          this.clientSockets.delete(clientId)
          connectionClosed(clientId)
        })

        ws.on("message", () => {
          // receiving any message is considered a sign of life,
          // but currently the client only sends PONG_MSG
          ws.alive = true
        })
      },
    )

    const pingTimer = setInterval(() => {
      this.clientSockets.forEach((ws) => {
        if (!ws.alive) {
          // missing 2nd keep-alive period
          ws.terminate()
          return
        }

        ws.alive = false
        ws.send(PING_MSG)
      })
    }, options.pingInterval)

    this.wss.on("close", () => {
      clearInterval(pingTimer)
    })
  }

  publish(clientId: string, itemName: string, parameters: unknown[], data: unknown) {
    const message = [itemName, data, ...parameters]

    const ws = this.clientSockets.get(clientId)

    if (ws) {
      ws.send(safeStringify(message))
    }
  }

  isClientSubscribed(clientId: string): boolean {
    return this.clientSockets.has(clientId)
  }

  private wss: WebSocketServer
  private clientSockets = new Map<string, WebSocket & {alive: boolean}>()

  async close() {
    return new Promise<void>((resolve, reject) => {
      this.clientSockets.forEach((c) => c.terminate())

      this.wss.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }
}

export type ConnectionsServerOptions = {
  pingInterval: number
  path: string
}
