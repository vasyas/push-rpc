import {SocketServer} from "@push-rpc/core"

import * as WebSocket from "ws"
import {wrapWebsocket} from "./client"

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

export function createWebsocket(url) {
  return wrapWebsocket(new WebSocket(url))
}
