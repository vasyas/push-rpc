import * as log from "why-is-node-running"
import "isomorphic-fetch"
import {createRpcClient, setLogger} from "../../../core/src"
import {createHttpClient} from "../../src/client"

setLogger(console)
;(async () => {
  try {
    const {remote} = await createRpcClient(0, () => createHttpClient("http://localhost:5555/rpc"))

    console.log("Client connected")

    console.log("From server: " + (await remote.getHello()))
  } catch (e) {
    console.log(e)
  }

  // log()
})()
