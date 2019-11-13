import * as WebSocket from "ws"
import {createRpcClient, setLogger} from "../../src"
import {Server} from "./shared"

setLogger(console);

(async () => {
  const server: Server = await createRpcClient({
    level: 0,
    createWebSocket: () => new WebSocket("ws://localhost:5555")
  })

  console.log("Client connected")

  // const s = await server.getServerHello()
  // console.log(s)
})()