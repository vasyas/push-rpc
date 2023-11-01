import "isomorphic-fetch"
import {createRpcClient, setLogger} from "@push-rpc/core"
import {createHttpClient} from "../../src"

setLogger(console)
;(async () => {
  try {
    const {remote} = await createRpcClient(async () => createHttpClient("http://localhost:5555"))

    console.log("Client connected")

    console.log("From server: " + (await remote.getHello()))
  } catch (e) {
    console.log(e)
  }

  // log()
})()
