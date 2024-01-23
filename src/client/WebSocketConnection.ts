import WebSocket from "ws"
import {log} from "../logger.js"
import {safeParseJson} from "../utils/json.js"

export class WebSocketConnection {
  constructor(private url: string, private clientId: string, private consume: (itemName: string, parameters: unknown[], data: unknown) => void) {
    this.url = url
    this.clientId = clientId
  }

  async close() {
    if (this.socket) {
      return new Promise<void>((resolve) => {
        this.socket!.on("close", () => {
          this.socket = null
          resolve()
        })
        this.socket!.close()
      })
    }

    return Promise.resolve()

  }

  connect() {
    if (!this.socket) {
      this.socket = new WebSocket(this.url, this.clientId)

      this.socket.on("message", (message) => {
        this.receiveSocketMessage(message)
      })

      // TODO socket open timeout
      this.openSocketPromise = new Promise<void>((resolve, reject) => {
        this.socket!.onopen = () => resolve()
        this.socket!.onerror = (e) => reject(new Error("Failed to connect client. " + e.message))
      }).catch((e) => {
        log.warn("Failed to establish websocket connection. " + e.message)
      })
    }

    return this.openSocketPromise!
  }

  private socket: WebSocket | null = null
  private openSocketPromise: Promise<void> | null = null

  private async receiveSocketMessage(rawMessage: WebSocket.RawData) {
    try {
      const msg = rawMessage.toString()

      const [itemName, data, ...parameters] = safeParseJson(msg)

      this.consume(itemName, parameters, data)
    } catch (e) {
      log.warn("Invalid message received", e)
    }
  }
}