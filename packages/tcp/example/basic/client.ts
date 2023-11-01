import {createRpcClient, setLogger} from "@push-rpc/core"
import {createSocket} from "../../src/client"

setLogger(console)
;(async () => {
  const {remote} = await createRpcClient(() => createSocket("localhost", 5555))

  console.log("Client connected")

  console.log("From server: " + (await remote.getHello()))
})()
