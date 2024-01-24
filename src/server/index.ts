import {CLIENT_ID_HEADER, Services} from "../rpc.js"
import {ServicesWithTriggers} from "./local.js"
import {Middleware} from "../utils/middleware.js"
import {RpcServerImpl} from "./RpcServerImpl.js"
import {IncomingMessage} from "http"

export async function publishServices<S extends Services>(
  services: S,
  overrideOptions: Partial<PublishServicesOptions> & {port: number}
): Promise<{
  server: RpcServer
  services: ServicesWithTriggers<S>
}> {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const rpcServer = new RpcServerImpl<S>(services, options)

  await rpcServer.start()

  return {
    services: rpcServer.createServicesWithTriggers(),
    server: rpcServer,
  }
}

export type RpcServer = {
  close(): Promise<void>
  // test-only
  _allSubscriptions(): Array<any[]>
}

export type PublishServicesOptions = {
  port: number
  path: string
  host: string
  middleware: Middleware[]
  pingInterval: number
  createContext(req: IncomingMessage): Promise<RpcContext>
}

export type RpcContext = {
  clientId: string
}

const defaultOptions: Omit<PublishServicesOptions, "port"> = {
  path: "",
  host: "0.0.0.0",
  middleware: [],
  pingInterval: 30 * 1000, // should be in-sync with client

  async createContext(req: IncomingMessage): Promise<RpcContext> {
    return {
      clientId: req.headersDistinct[CLIENT_ID_HEADER]?.[0] || "anon",
    }
  },
}
