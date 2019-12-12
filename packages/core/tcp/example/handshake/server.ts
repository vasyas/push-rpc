import {createRpcServer, RpcConnectionContext, RpcContext, setLogger, Socket} from "@push-rpc/core"
import {createSocketServer} from "../../src/server"

setLogger(console)

const services = {
  async getHello(_, ctx: RpcContext) {
    return "Hello, " + ctx.remoteId
  },
}

createRpcServer(services, createSocketServer(5555), {
  createConnectionContext(socket: Socket, transportDetails: any): Promise<RpcConnectionContext> {
    return new Promise((resolve, reject) => {
      let handshaked = false

      const timer = setTimeout(() => {
        handshaked = true
        reject("Handshake timeout")
      }, 2000)

      socket.onMessage(data => {
        console.log("HS: " + data)

        if (handshaked) return

        handshaked = true
        clearTimeout(timer)

        resolve({
          remoteId: data,
        })
      })
    })
  },
})

console.log("RPC Server started at localhost:5555")
