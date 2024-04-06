import {
  consumeServices,
  ConsumeServicesOptions,
  publishServices,
  PublishServicesOptions,
  RpcClient,
  RpcContext,
  RpcServer,
  Services,
  ServicesWithSubscriptions,
  ServicesWithTriggers,
} from "../src/index.js"
import WebSocket from "ws"

;(global as any).WebSocket = WebSocket

export const TEST_PORT = 5555

export let testServer: RpcServer | null = null

export async function startTestServer<S extends Services<S>, C extends RpcContext>(
  local: S,
  options: Partial<PublishServicesOptions<C>> = {}
): Promise<ServicesWithTriggers<S>> {
  const r = await publishServices<S, C>(local, {
    port: TEST_PORT,
    path: "/rpc",
    ...options,
  })
  testServer = r.server
  return r.services
}

export let testClient: RpcClient | null = null

export async function createTestClient<S extends Services<S>>(
  options?: Partial<ConsumeServicesOptions>
): Promise<ServicesWithSubscriptions<S>> {
  if (!options) options = {}
  if (!options.middleware) options.middleware = []
  options.middleware = [logMiddleware, ...options.middleware]
  if (!options.notificationsMiddleware) options.notificationsMiddleware = []
  options.notificationsMiddleware = [logUpdatesMiddleware, ...options.notificationsMiddleware]

  const r = await consumeServices<S>(`http://127.0.0.1:${TEST_PORT}/rpc`, options)
  testClient = r.client
  return r.remote
}

afterEach(async function () {
  this.timeout(4000)

  if (testClient) {
    await testClient.close()
    testClient = null
  }
  if (testServer) {
    await testServer.close()
    testServer = null
  }
})

async function logMiddleware(ctx: RpcContext, next: any, ...params: any) {
  try {
    console.log(`OUT:${ctx.invocationType} '${ctx.itemName}'`, ...params)

    const r = await next()

    console.log(`IN:${ctx.invocationType} '${ctx.itemName}'`, r)
    return r
  } catch (e) {
    console.log(`ERR:${ctx.invocationType} '${ctx.itemName}'`, e)
    throw e
  }
}

async function logUpdatesMiddleware(ctx: RpcContext, next: any, res: any) {
  console.log(`IN:${ctx.invocationType} '${ctx.itemName}'`, res)
  return next()
}
