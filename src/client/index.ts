import {RpcContext, Services} from "../rpc.js"
import {ServicesWithSubscriptions} from "./remote.js"
import {RpcClientImpl} from "./RpcClientImpl.js"
import {Middleware} from "../utils/middleware.js"

export type RpcClient = {
  isConnected(): boolean
  close(): Promise<void>

  // test-only
  _allSubscriptions(): Array<any[]>
  _webSocket(): WebSocket | null
}

export type ConsumeServicesOptions = {
  callTimeout: number
  reconnectDelay: number
  errorDelayMaxDuration: number
  pingInterval: number | null
  subscriptions: boolean
  middleware: Middleware<RpcContext>[]
  connectOnCreate: boolean
  onConnected: () => void
  onDisconnected: () => void
}

export async function consumeServices<S extends Services<S>>(
  url: string,
  overrideOptions: Partial<ConsumeServicesOptions> = {}
): Promise<{
  client: RpcClient
  remote: ServicesWithSubscriptions<S>
}> {
  if (url.endsWith("/")) {
    throw new Error("URL must not end with /")
  }

  const options = {
    ...defaultOptions,
    ...overrideOptions,
  }

  const client = new RpcClientImpl<S>(url, options)

  if (options.connectOnCreate) {
    await client.connect()
  }

  return {
    client,
    remote: client.createRemote(),
  }
}

const defaultOptions: ConsumeServicesOptions = {
  callTimeout: 5 * 1000,
  reconnectDelay: 0,
  errorDelayMaxDuration: 15 * 1000,
  pingInterval: null, // if set, should be in-sync with server, ie 30 * 1000
  subscriptions: true,
  middleware: [],
  connectOnCreate: false,
  onConnected: () => {},
  onDisconnected: () => {},
}
