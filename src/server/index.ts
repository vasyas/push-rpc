import {Services} from "../rpc.js"
import {ServicesWithTriggers} from "./local.js"
import {Middleware} from "../utils/middleware.js"
import {RpcServerImpl} from "./RpcServerImpl.js"

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
}

export type RpcContext = {
  clientId: string
}

const defaultOptions: Omit<PublishServicesOptions, "port"> = {
  path: "",
  host: "0.0.0.0",
  middleware: [],
  pingInterval: 30 * 1000, // should be in-sync with client
}
