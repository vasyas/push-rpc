import WebSocket from "ws"
import {Socket, SocketServer} from "@push-rpc/core"

/**
 * Create Push-RPC SocketServer using WebSocket transport.
 *
 * Uses [ws](https://github.com/websockets/ws) NPM package under the hood.
 */
export function createWebsocketServer(
  options: WebSocket.ServerOptions = {noServer: true}
): SocketServer & {wss: WebSocket.Server} {
  const wss = new WebSocket.Server(options)

  return {
    onError: h => {
      wss.on("error", h)
    },
    onConnection: h => {
      wss.on("connection", (ws, req) => h(wrapWebsocket(ws), req, ws.protocol))
    },
    close: h => wss.close(h),
    wss,
  }
}

/**
 * Create Push-RPC Socket using WebSocket transport.
 *
 * Uses [ws](https://github.com/websockets/ws) NPM package under the hood.
 */
export function createNodeWebsocket(url: string, protocol?: string | string[]) {
  return wrapWebsocket(new WebSocket(url, protocol))
}

export function wrapWebsocket(ws): Socket {
  let errorHandler: (e: any) => void = () => {}

  let messageReplay = []

  ws.on("message", e => {
    if (messageReplay) {
      messageReplay.push(e.toString("utf-8"))
    }
  })

  return {
    onMessage: h => {
      for (const message of messageReplay) {
        h(message)
      }

      messageReplay = null

      ws.on("message", e => {
        h(e.toString("utf-8"))
      })
    },
    onOpen: h => ws.on("open", h),
    onDisconnected: h =>
      ws.on("close", (code, reason) => {
        h(code, reason)
      }),
    onError: h => {
      errorHandler = h
      ws.on("error", h)
    },
    onPong: h => ws.on("pong", h),
    onPing: h => ws.on("ping", h),

    disconnect: () => ws.terminate(),
    send: data => {
      try {
        ws.send(data)
      } catch (e) {
        errorHandler(e)
      }
    },
    ping: data => {
      try {
        ws.ping(data)
      } catch (e) {
        errorHandler(e)
      }
    },
  }
}
