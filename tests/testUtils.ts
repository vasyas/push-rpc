import {
  consumeServices,
  ConsumeServicesOptions,
  publishServices,
  RpcClient,
  RpcServer,
  Services,
  ServicesWithSubscriptions,
  ServicesWithTriggers,
} from "../src/index.js"

export const TEST_PORT = 5555

export let testServer: RpcServer | null = null

export async function startTestServer<S extends Services>(local: S): Promise<ServicesWithTriggers<S>> {
  const r = await publishServices<S>(local, {
    port: TEST_PORT,
    path: "/rpc"
  })
  testServer = r.server
  return r.services
}

export let testClient: RpcClient | null = null

export async function createTestClient<S extends Services>(
  options?: Partial<ConsumeServicesOptions>
): Promise<ServicesWithSubscriptions<S>> {
  const r = await consumeServices<S>(`http://127.0.0.1:${TEST_PORT}/rpc`, options)
  testClient = r.client
  return r.remote
}

afterEach(async () => {
  if (testClient) {
    await testClient.close()
  }
  if (testServer) {
    await testServer.close()
  }
})
