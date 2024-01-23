import {RpcClient, RpcServer, Services, ServicesWithSubscriptions,} from "../src/index.js"
import {consumeServices, ConsumeServicesOptions} from "../src/client/index.js"
import {publishServices} from "../src/server/index.js"

export const TEST_PORT = 5555

export let testServer: RpcServer | null = null

export async function startTestServer<T extends Services>(local: T): Promise<T> {
  const r = await publishServices(local)
  testServer = r.server
  return r.services
}

export let testClient: RpcClient | null = null

export async function createTestClient<T extends Services>(
  options?: Partial<ConsumeServicesOptions>
): Promise<ServicesWithSubscriptions<T>> {
  const r = await consumeServices(`http://127.0.0.1:${TEST_PORT}/rpc`, options)
  testClient = r.client
  return r.remote
}

afterEach(async () => {
  if (testClient) {
    await testClient.shutdown()
  }
  if (testServer) {
    await testServer.shutdown()
  }
})
