import {createRpcServer, setLogger} from "../../src/index"
import {Server} from "./shared"

setLogger(console);

class ServerImpl implements Server {
  async getServerHello(): Promise<string> {
    return "Hello from server"
  }
}

createRpcServer(new ServerImpl(), {wss: {port: 5555}})

console.log("RPC Server started at ws://localhost:5555")
