import * as Koa from "koa"
import {createRpcServer, setLogger} from "../../../core/src"
import {createHttpServer} from "../../src/server"

setLogger(console)

const services = {
  async getHello() {
    return "Hello from Server"
  },
}

function getRemoteId(ctx: Koa.Context) {
  return "1" // share a single session for now
}

createRpcServer(services, createHttpServer(5555, getRemoteId, {prefix: "rpc"}), {
  listeners: {
    connected: (remoteId, connections) => {},
    disconnected: (remoteId, connections) => {},
    messageIn: (remoteId, data) => {
      console.debug("RPC in", data)
    },
    messageOut: (remoteId, data) => {
      console.debug("RPC out", data)
    },
    subscribed: subscriptions => {},
    unsubscribed: subscriptions => {},
  },
})

console.log("RPC Server started at http://localhost:5555/rpc")
