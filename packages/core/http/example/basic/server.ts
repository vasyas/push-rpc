import {createRpcServer, setLogger} from "../../../core/src"
import {createHttpServer} from "../../src/server"

setLogger(console)

const services = {
  async getHello() {
    return "Hello from Server"
  },
}

createRpcServer(services, createHttpServer(5555, "rpc"))

console.log("RPC Server started at http://localhost:5555/rpc")
