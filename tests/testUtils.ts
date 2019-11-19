import {createRpcClient, createRpcServer, LocalTopicImpl} from "../src"
import * as WebSocket from "ws"
import {RpcServerOptions} from "../src/server"

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
    wss = createRpcServer(local, {wss: {port: TEST_PORT}, listeners, ...opts}).wss
    wss.addListener("listening", resolve)
  })
}

afterEach(() => new Promise(resolve => {
  if (wss) {
    wss.close(resolve)
  }
}))

export async function createTestClient(level = 1) {
  return (await createRpcClient(level, () => new WebSocket(`ws://localhost:${TEST_PORT}`))).remote
}
