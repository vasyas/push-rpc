import * as WebSocket from "ws"
import {Socket, SocketServer} from "@push-rpc/core"

export function createWebsocketServer(
  options: WebSocket.ServerOptions = {noServer: true}
): SocketServer & {wss: WebSocket.Server} {
  const wss = new WebSocket.Server(options)

  return {
    onError: h => {
      wss.on("error", h)
    },
    onConnection: h => {
      wss.on("connection", (ws, req) => h(wrapWebsocket(ws), req))
    },
    close: h => wss.close(h),
    wss,
  }
}

export function createWebsocket(url, protocol?) {
  return wrapWebsocket(new WebSocket(url, protocol))
}

export function wrapWebsocket(ws): Socket {
  return {
    onMessage: h =>
      ws.on("message", e => {
        h(e.toString("utf-8"))
      }),
    onOpen: h => ws.on("open", h),
    onClose: h =>
      ws.on("close", (code, reason) => {
        h(code, reason)
      }),
    onError: h => ws.on("error", h),
    onPong: h => ws.on("pong", h),

    terminate: () => ws.terminate(),
    send: data => ws.send(data),
    ping: data => ws.ping(data),
  }
}
