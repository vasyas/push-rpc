import {createRpcClient, createRpcServer, RpcClientOptions, RpcServer} from "../src"
import {RpcServerOptions} from "../src/server"
import {createNodeWebsocket, createWebsocketServer} from "../../websocket/src/server"

export const TEST_PORT = 5555

let wss = null

const listeners = {
  messageIn: (remoteId, data) => console.log("In", remoteId, data),
  messageOut: (remoteId, data) => console.log("Out", remoteId, data),
  subscribed: () => {},
  unsubscribed: () => {},
  connected: id => console.log("Connected", id),
  disconnected: id => console.log("Disconnected", id),
}

export function startTestServer(local, opts: RpcServerOptions = {}): Promise<RpcServer> {
  return new Promise(resolve => {
    const socketServer = createWebsocketServer({port: TEST_PORT})
    wss = socketServer.wss

    const rpcServer = createRpcServer(local, socketServer, {listeners, ...opts})

    wss.addListener("listening", () => resolve(rpcServer))
  })
}

afterEach(
  () =>
    new Promise(resolve => {
      if (wss) {
        wss.close(resolve)
      } else {
        resolve()
      }
    })
)

export async function createTestClient(
  level = 1,
  options: Partial<RpcClientOptions> = {},
  protocol?
) {
  return (
    await createRpcClient(
      level,
      () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`, protocol),
      options
    )
  ).remote
}
