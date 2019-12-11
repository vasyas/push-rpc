import {SocketServer} from "../transport"
import * as WebSocket from "ws"
import {wrapWebsocket} from "./websocketClient"

export function createWebsocketServer(
  options: WebSocket.ServerOptions = {noServer: true}
): SocketServer & {wss: WebSocket.Server} {
  const wss = new WebSocket.Server(options)

  function onError(handler) {
    wss.on("error", handler)
  }

  function onConnection(handler) {
    wss.on("connection", (ws, req) => {
      handler(wrapWebsocket(ws), req)
    })
  }

  function close(cb) {
    wss.close(cb)
  }

  return {
    onError,
    onConnection,
    close,
    wss,
  }
}

export function createWebsocket(url) {
  return wrapWebsocket(new WebSocket(url))
}
