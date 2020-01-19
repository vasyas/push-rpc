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

createRpcServer(services, createHttpServer(5555, getRemoteId, {prefix: "rpc"}))

console.log("RPC Server started at http://localhost:5555/rpc")
