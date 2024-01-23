import {safeStringify} from "../utils/json.js"
import WebSocket, {WebSocketServer} from "ws"
import http from "http"
import {log} from "../logger.js"

export class ConnectionsServer {
  constructor(server: http.Server) {
    const wss = new WebSocketServer({server})

    wss.on("connection", (ws: WebSocket) => {
      const clientId = ws.protocol || "anon"
      this.clientSockets.set(clientId, ws)

      log.debug("New client connected", clientId)

      ws.on("error", (e: unknown) => {
        log.error("Error in WS", e)
      })

      ws.on("close", () => {
        this.clientSockets.delete(clientId)
      })
    })
  }

  publish(clientId: string, itemName: string, parameters: unknown[], data: unknown) {
    const message = [itemName, data, ...parameters]

    const ws = this.clientSockets.get(clientId)

    if (ws) {
      ws.send(safeStringify(message))
    }
  }

  private clientSockets = new Map<string, WebSocket>()
}