import "isomorphic-fetch"
import {createRpcClient, setLogger} from "@push-rpc/core"
import {createHttpClient} from "../../src/client"

setLogger(console)
;(async () => {
  const {remote} = await createRpcClient(0, () => createHttpClient("http://localhost:5555/rpc"))

  try {
    console.log("Client connected")

    console.log("From server: " + (await remote.getHello()))
  } catch (e) {
    console.log(e)
  }
})()
