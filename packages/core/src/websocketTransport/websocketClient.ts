import {Socket} from "../transport"

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
