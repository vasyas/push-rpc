import {safeStringify} from "../utils/json.js"
import WebSocket, {WebSocketServer} from "ws"
import http from "http"
import {log} from "../logger.js"

export class ConnectionsServer {
  constructor(
    server: http.Server,
    options: ConnectionsServerOptions,
    connectionClosed: (clientId: string) => void,
    closeSocketsWithDifferentPath: boolean,
  ) {
    this.wss = new WebSocketServer({noServer: true})

    server.on("upgrade", (request, socket, head) => {
      if (request.url?.startsWith(options.path)) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request)
        })
      } else {
        if (closeSocketsWithDifferentPath) {
          socket.destroy()
        }
      }
    })

    this.wss.on("connection", (ws: WebSocket & {alive: boolean}) => {
      ws.alive = true

      const clientId = ws.protocol || "anon"
      this.clientSockets.set(clientId, ws)

      ws.on("error", (e: unknown) => {
        log.error("Error in WS", e)
      })

      ws.on("close", () => {
        this.clientSockets.delete(clientId)
        connectionClosed(clientId)
      })

      ws.on("pong", () => {
        ws.alive = true
      })
    })

    const pingTimer = setInterval(() => {
      this.clientSockets.forEach((ws) => {
        if (!ws.alive) {
          // missing 2nd keep-alive period
          ws.terminate()
          return
        }

        ws.alive = false
        ws.ping()
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
