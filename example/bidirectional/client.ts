import * as WebSocket from "ws"
import {createRpcClient, setLogger} from "../../src"
import {Client} from "./shared"

setLogger(console)

;(async () => {
  const local: Client = {
    getClientHello: async () => "Hello from client",
  }

  const {remote} = await createRpcClient(0, () => new WebSocket("ws://localhost:5555"), {local})

  console.log("Client connected")

  const s = await remote.getServerHello()
  console.log(s)
})()
