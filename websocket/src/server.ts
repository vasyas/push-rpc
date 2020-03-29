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
      wss.on("connection", (ws, req) => h(wrapWebsocket(ws), req, ws.protocol))
    },
    close: h => wss.close(h),
    wss,
  }
}

export function createWebsocket(url, protocol?) {
  return wrapWebsocket(new WebSocket(url, protocol))
}

export function wrapWebsocket(ws): Socket {
  let errorHandler: (e: any) => void = () => {}

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
    onError: h => {
      errorHandler = h
      ws.on("error", h)
    },
    onPong: h => ws.on("pong", h),
    onPing: h => ws.on("ping", h),

    terminate: () => ws.terminate(),
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
