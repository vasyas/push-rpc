import {createRpcClient, createRpcServer, LocalTopicImpl} from "../src"
import * as WebSocket from "ws"
import {Options} from "../src/local"

export const TEST_PORT = 5555

let wss = null

export function startTestServer(local, opts: Options = {}) {
  return new Promise(resolve => {
    wss = createRpcServer(local, {wss: {port: TEST_PORT}, ...opts}).wss
    wss.addListener("listening", resolve)
  })
}

afterEach(() => new Promise(resolve => {
  if (wss) {
    wss.close(resolve)
  }
}))

export async function createTestClient() {
  return await createRpcClient({
    level: 1,
    createWebSocket: () => new WebSocket(`ws://localhost:${TEST_PORT}`)
  })
}
