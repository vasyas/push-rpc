import {Socket} from "@push-rpc/core"
import * as net from "net"

export function createSocket(host, port): Socket {
  const socket = new net.Socket()
  socket.connect(port, host)

  return wrapSocket(socket)
}

export function wrapSocket(socket: net.Socket): Socket {
  return {
    onMessage: h => {
      socket.on("data", data => h(data.toString("utf8")))
    },

    onOpen: h => socket.on("connect", h),

    onDisconnected: h =>
      socket.on("close", error => {
        h(error ? 1 : 0, error ? "error" : null)
      }),

    onError: h => socket.on("error", h),

    onPong: h => {
      // not implemented
    },

    onPing(h: () => void) {
      // not implemented
    },

    disconnect: () => socket.destroy(),
    send: data => socket.write(data),
    ping: data => {
      // not implemented
    },
  }
}
