import {createRpcClient, setLogger} from "@push-rpc/core"
import {wrapSocket} from "../../src/client"
import * as net from "net"

setLogger(console)

// Demo async connection context to implement custom handshake
;(async () => {
  const {remote} = await createRpcClient(0, () => {
    const socket = new net.Socket()
    socket.connect(5555, "localhost")

    socket.on("connect", () => {
      socket.write("my-id")
    })

    return wrapSocket(socket)
  })

  console.log("Client connected")

  console.log("From server: " + (await remote.getHello()))
})()
