import * as WebSocket from "ws"
import {createRpcClient, setLogger} from "../../src"
import {Client} from "./shared"
import {createWebsocket} from "../../src/websocketTransport/websocketServer"

setLogger(console)
;(async () => {
  const local: Client = {
    getClientHello: async () => "Hello from client",
  }

  const {remote} = await createRpcClient(0, () => createWebsocket("ws://localhost:5555"), {
    local,
  })

  console.log("Client connected")

  const s = await remote.getServerHello()
  console.log(s)
})()
