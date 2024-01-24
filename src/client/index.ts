import {Services} from "../rpc.js"
import {ServicesWithSubscriptions} from "./remote.js"
import WebSocket from "ws"
import {RpcClientImpl} from "./RpcClientImpl.js"

export type RpcClient = {
  isConnected(): boolean
  close(): Promise<void>

  // test-only
  _subscriptions(): Map<any, any>
  _webSocket(): WebSocket | null
}

export type ConsumeServicesOptions = {
  callTimeout: number
  subscribe: boolean
  reconnectDelay: number
  errorDelayMaxDuration: number
  pingInterval: number
}

export async function consumeServices<S extends Services>(
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

  return {
    client,
    remote: client.createRemote(),
  }
}

const defaultOptions: ConsumeServicesOptions = {
  callTimeout: 5 * 1000,
  subscribe: true,
  reconnectDelay: 0,
  errorDelayMaxDuration: 15 * 1000,
  pingInterval: 30 * 1000, // should be in-sync with server
}
