import {createRpcServer, setLogger} from "../../src/index"
import {Client, Server} from "./shared"
import {RpcContext} from "../../src/rpc"
import {createWebsocketServer} from "../../src/websocketTransport/websocketServer"

setLogger(console)

class ServerImpl implements Server {
  async getServerHello(_, ctx: RpcContext<Client>): Promise<string> {
    return "Hello from server and " + (await ctx.remote.getClientHello())
  }
}

createRpcServer(new ServerImpl(), createWebsocketServer({port: 5555}))

console.log("RPC Server started at ws://localhost:5555")
