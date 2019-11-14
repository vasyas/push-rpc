import {createRpcServer, setLogger} from "../../src/index"
import {Server} from "./shared"
import * as WebSocket from "ws"

setLogger(console);

class ServerImpl implements Server {
  async getServerHello(): Promise<string> {
    return "Hello from server"
  }
}

const rpcWebsocketServer = new WebSocket.Server({port: 5555})
createRpcServer(new ServerImpl(), rpcWebsocketServer)

console.log("RPC Server started at ws://localhost:5555")
