import {RpcConnectionContext, RpcContext, Services} from "../rpc.js"
import {ServicesImplementation} from "./implementation.js"
import {Middleware} from "../utils/middleware.js"
import {RpcServerImpl} from "./RpcServerImpl.js"
import http, {IncomingMessage, ServerResponse} from "http"
import {HttpServerHooks} from "./http"
import {getClientId} from "../utils/clientId.js"

export async function publishServices<S extends Services<S>, C extends RpcContext>(
  services: S,
  overrideOptions: Partial<PublishServicesOptions<C>> & ({port: number} | {server: http.Server}),
): Promise<{
  server: RpcServer
  services: ServicesImplementation<S>
  httpServer: http.Server
}> {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const rpcServer = new RpcServerImpl<S, C>(services, options)

  await rpcServer.start()

  return {
    services: rpcServer.implementation,
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
  // Maximum size of a request body, in bytes, measured after decompression. Requests exceeding
  // it are rejected with 413 before the body is fully buffered, bounding memory usage and
  // protecting against decompression bombs. Set to Infinity to disable.
  maxRequestSize: number
  // Called for both HTTP requests and WebSocket upgrades. `res` is undefined for WS upgrades.
  // Throwing rejects the request (HTTP) or the WebSocket upgrade (responds 401 and closes the socket).
  createConnectionContext(req: IncomingMessage, res?: ServerResponse): Promise<RpcConnectionContext>
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
  maxRequestSize: 1024 * 1024, // 1 MB

  async createConnectionContext(
    req: IncomingMessage,
    res?: ServerResponse,
  ): Promise<RpcConnectionContext> {
    return {
      clientId: getClientId(req) || "anon",
    }
  },
}
