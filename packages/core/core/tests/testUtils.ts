import {createRpcClient, createRpcServer, LocalTopicImpl} from "../src"
import * as WebSocket from "ws"
import {RpcServerOptions} from "../src/server"
import {createWebsocket, createWebsocketServer} from "../src/websocketTransport/websocketServer"

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

export function startTestServer(local, opts: RpcServerOptions = {}) {
  return new Promise(resolve => {
    const socketServer = createWebsocketServer({port: TEST_PORT})
    wss = socketServer.wss
    wss.addListener("listening", resolve)

    createRpcServer(local, socketServer, {listeners, ...opts})
  })
}

afterEach(
  () =>
    new Promise(resolve => {
      if (wss) {
        wss.close(resolve)
      }
    })
)

export async function createTestClient(level = 1) {
  return (await createRpcClient(level, () => createWebsocket(`ws://localhost:${TEST_PORT}`))).remote
}
