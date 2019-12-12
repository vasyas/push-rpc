import * as net from "net"
import {SocketServer} from "@push-rpc/core"
import {wrapSocket} from "./client"

export function createSocketServer(port): SocketServer {
  const s = new net.Server()
  s.listen(port)

  return {
    onError: e => s.on("error", e),

    onConnection: h => {
      s.on("connection", (socket, req) => {
        h(wrapSocket(socket), req)
      })
    },
    close: h => s.close(h),
  }
}
