import {RpcContext, Services} from "../rpc.js"
import {ServicesClient} from "./remote.js"
import {RpcClientImpl} from "./RpcClientImpl.js"
import {Middleware} from "../utils/middleware.js"

export type RpcClient = {
  readonly clientId: string

  connect(): Promise<void>
  isConnected(): boolean
  close(): Promise<void>
  /** Replace a stale connection; immediate wakes backoff but reuses an opening handshake. */
  reconnect(options?: {immediate?: boolean}): void
  /** Refresh all active snapshots without replacing the WebSocket connection. */
  resubscribe(): void

  // test-only
  _allSubscriptions(): Array<any[]>
  _webSocket(): WebSocket | null
}

export type ClientCache = {
  put(itemName: string, parameters: unknown[], value: unknown): void
  get(itemName: string, parameters: unknown[]): unknown | undefined
}

export type ReconnectPolicy = {
  /** Optional delay for the first recovery after a stable connection; failures still back off. */
  firstReconnectDelayMs?: number
  /** Lower and upper bounds of a failed-attempt retry window, in milliseconds. */
  minDelayMs: number
  maxDelayMs: number
  /** Widen the upper bound after each attempt, until maxBackoffMs. */
  backoffFactor: number
  maxBackoffMs: number
  /** Only a connection that remains open this long resets the retry window. */
  stableConnectionMs: number
  /** Abandon an opening handshake that has not completed by this deadline. */
  connectTimeoutMs: number
  /** Also spread the very first connection. Defaults to false for fast startup. */
  spreadInitialConnect?: boolean
}

export type ConsumeServicesOptions = {
  callTimeout: number
  reconnectDelay: number
  /** Opt in to jittered recovery. Omit to retain the legacy reconnect timing. */
  reconnectPolicy?: ReconnectPolicy
  /** Maximum simultaneous recovery snapshots, including unfinished previous waves. */
  resubscribeConcurrency?: number
  /** Requires a backend implementing lifetime protocol v1; omitted preserves legacy behavior. */
  subscriptionLifetimes?: boolean
  errorDelayMaxDuration: number
  /**
   * Milliseconds to wait before considering the connection stale and trying to reconnect.
   * Should match the server pingInterval.
   */
  pingInterval: number | null
  subscriptions: boolean
  middleware: Middleware<RpcContext>[]
  notificationsMiddleware: Middleware<RpcContext>[]
  connectOnCreate: boolean
  onConnected: () => void
  onDisconnected: () => void
  getHeaders: () => Promise<Record<string, string>>
  getSubscriptionsUrl(url: string): string
  cache: ClientCache | null
}

export async function consumeServices<S extends Services<S>>(
  url: string,
  overrideOptions: Partial<ConsumeServicesOptions> = {},
): Promise<{
  client: RpcClient
  remote: ServicesClient<S>
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
  notificationsMiddleware: [],
  connectOnCreate: false,
  onConnected: () => {},
  onDisconnected: () => {},
  getHeaders: async () => ({}),

  getSubscriptionsUrl(url: string): string {
    return url.replace(/^https(.*)/, "wss$1").replace(/^http(.*)/, "ws$1")
  },
  cache: null,
}
