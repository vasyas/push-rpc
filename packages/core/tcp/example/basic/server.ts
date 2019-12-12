import {createRpcServer, setLogger} from "@push-rpc/core"
import {createSocketServer} from "../../src/server"

setLogger(console)

const services = {
  async getHello() {
    return "Hello from Server"
  },
}

createRpcServer(services, createSocketServer(5555))

console.log("RPC Server started at localhost:5555")
