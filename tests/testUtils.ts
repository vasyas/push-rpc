import {
  createRpcClient,
  createRpcServer,
  RpcClient,
  RpcServer,
  Services,
  ServicesWithSubscriptions,
} from "../src/index.js"
import {ComboClientTransport, ComboServerTransport} from "@push-rpc/combo"
import {WebSocketClientTransport, WebSocketServerTransport} from "@push-rpc/websocket"

export const TEST_PORT = 5555

export let testRpcServer: RpcServer | null = null

export async function startTestServer<T extends Services>(local: T): Promise<T> {
  let transport = null

  switch (getTransport()) {
    case "combo":
      transport = new ComboServerTransport(TEST_PORT, "/rpc")
    case "ws":
      transport = new WebSocketServerTransport(TEST_PORT)
  }

  const r = await createRpcServer(local, transport!)
  testRpcServer = r.server

  return r.services as any
}

export let testRpcClient: RpcClient | null = null

export async function createTestClient<T extends Services>(
  clientTransportOptions?: any
): Promise<ServicesWithSubscriptions<T>> {
  let transport = null

  switch (getTransport()) {
    case "combo":
      transport = new ComboClientTransport(
        `http://127.0.0.1:${TEST_PORT}/rpc`,
        clientTransportOptions
      )
    case "ws":
      transport = new WebSocketClientTransport(
        `http://127.0.0.1:${TEST_PORT}/rpc`,
        clientTransportOptions
      )
  }

  const r = await createRpcClient<T>(transport!)
  testRpcClient = r.client

  return r.remote
}

export function getTransport(): "combo" | "ws" {
  // if (!process.env.TRANSPORT) {
  //   throw new Error("TRANSPORT environment variable must be set")
  // }

  // return process.env.TRANSPORT || "combo"

  return "ws"
}

afterEach(async () => {
  if (testRpcClient) {
    await testRpcClient.shutdown()
  }
  if (testRpcServer) {
    await testRpcServer.shutdown()
  }
})
