import {CLIENT_ID_HEADER, RpcConnectionContext, RpcContext, Services} from "../rpc.js"
import {ServicesWithTriggers} from "./local.js"
import {Middleware} from "../utils/middleware.js"
import {RpcServerImpl} from "./RpcServerImpl.js"
import http, {IncomingMessage, ServerResponse} from "http"
import {HttpServerHooks} from "./http"

export async function publishServices<S extends Services<S>, C extends RpcContext>(
  services: S,
  overrideOptions: Partial<PublishServicesOptions<C>> & ({port: number} | {server: http.Server}),
): Promise<{
  server: RpcServer
  services: ServicesWithTriggers<S>
  httpServer: http.Server
}> {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const rpcServer = new RpcServerImpl<S, C>(services, options)

  await rpcServer.start()

  return {
    services: rpcServer.createServicesWithTriggers(),
    server: rpcServer,
    httpServer: rpcServer.httpServer,
  }
}

export type RpcServer = {
  close(): Promise<void>
  // test-only
  _allSubscriptions(): Array<any[]>
}

export type PublishServicesOptions<C extends RpcContext> = {
  host: string
  path: string
  middleware: Middleware<C>[]
  pingInterval: number
  subscriptions: boolean
  createConnectionContext(req: IncomingMessage, res: ServerResponse): Promise<RpcConnectionContext>
  createServerHooks?(hooks: HttpServerHooks, req: IncomingMessage): HttpServerHooks
} & (
  | {
  server: http.Server
}
  | {
  port: number
}
  | {}
  )

const defaultOptions: Omit<PublishServicesOptions<RpcContext>, "port"> = {
  path: "",
  host: "0.0.0.0",
  middleware: [],
  pingInterval: 30 * 1000, // should be in-sync with client
  subscriptions: true,

  async createConnectionContext(req: IncomingMessage, res: ServerResponse): Promise<RpcConnectionContext> {
    const header = req.headers[CLIENT_ID_HEADER]

    return {
      clientId: (Array.isArray(header) ? header[0] : header) || "anon",
    }
  },
}
