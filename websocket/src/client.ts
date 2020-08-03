import {Socket} from "@push-rpc/core"

export function createWebsocket(url, protocol?) {
  return wrapWebsocket(new WebSocket(url, protocol))
}

export function wrapWebsocket(ws: WebSocket): Socket {
  return {
    onMessage: h =>
      (ws.onmessage = e => {
        h(e.data.toString())
      }),
    onOpen: h => (ws.onopen = h),
    onDisconnected: h =>
      (ws.onclose = ({code, reason}) => {
        h(code, reason)
      }),
    onError: h => (ws.onerror = h),
    onPong: h => {
      // not implemented
    },
    onPing: h => {
      // not implemented
    },

    disconnect: () => ws.close(),
    send: data => ws.send(data),
    ping: () => {
      // not implemented
    },
  }
}
