import {RpcSession} from "./RpcSession"
import {log} from "./logger"
import {dateReviver} from "./utils"
import {Middleware, RpcConnectionContext} from "./rpc"
import {Socket} from "./transport"

export interface RpcClientListeners {
  connected(): void
  disconnected({code, reason}): void

  messageIn(data: string): void
  messageOut(data: string): void
  subscribed(subscriptions: number): void
  unsubscribed(subscriptions: number): void
}

export interface RpcClient<R> {
  remote: R
  disconnect(): Promise<void>
}

export interface RpcClientOptions {
  local: any
  listeners: RpcClientListeners
  reconnect: boolean
  reconnectDelay: number
  createContext(): RpcConnectionContext
  localMiddleware: Middleware
  remoteMiddleware: Middleware
  messageParser(data): any[]
  pingSendTimeout: number
  keepAliveTimeout: number
  callTimeout: number
  syncRemoteCalls: boolean
  delayCalls: number
}

const defaultOptions: RpcClientOptions = {
  local: {},
  listeners: {
    connected: () => {},
    disconnected: () => {},

    messageIn: () => {},
    messageOut: () => {},
    subscribed: () => {},
    unsubscribed: () => {},
  },
  reconnect: false,
  reconnectDelay: 0,
  createContext: () => ({remoteId: null}),
  localMiddleware: (ctx, next, params, messageType) => next(params),
  remoteMiddleware: (ctx, next, params, messageType) => next(params),
  messageParser: data => JSON.parse(data, dateReviver),
  pingSendTimeout: null,
  keepAliveTimeout: null,
  callTimeout: 30 * 1000,
  syncRemoteCalls: false,
  delayCalls: 0,
}

export function createRpcClient<R = any>(
  level,
  createSocket: () => Promise<Socket>,
  options: Partial<RpcClientOptions> = {}
): Promise<RpcClient<R>> {
  const opts: RpcClientOptions = {...defaultOptions, ...options}

  const session = new RpcSession(
    opts.local,
    level,
    opts.listeners,
    opts.createContext(),
    opts.localMiddleware,
    opts.remoteMiddleware,
    opts.messageParser,
    opts.pingSendTimeout,
    opts.keepAliveTimeout,
    opts.callTimeout,
    opts.syncRemoteCalls,
    opts.delayCalls
  )

  const client = {
    disconnectedMark: false,
    remote: session.remote,
    disconnect: async () => {
      client.disconnectedMark = true
      await session.disconnect()
    },
  }

  return (opts.reconnect ? startConnectionLoop : connect)(
    session,
    createSocket,
    opts.listeners,
    client,
    opts.reconnectDelay
  ).then(() => client)
}

function startConnectionLoop(
  session: RpcSession,
  createSocket: () => Promise<Socket>,
  listeners: RpcClientListeners,
  client: {disconnectedMark: boolean},
  reconnectDelay: number
): Promise<void> {
  return new Promise(resolve => {
    let onFirstConnection = resolve
    const errorDelay = {value: 0}

    const l = {
      ...listeners,
      connected: () => {
        // first reconnect after succesfull connection is immediate
        errorDelay.value = 0
        listeners.connected()
      },
    }

    connectionLoop(
      session,
      createSocket,
      l,
      () => {
        onFirstConnection()
        onFirstConnection = () => {}
      },
      errorDelay,
      client,
      reconnectDelay
    )
  })
}

function connectionLoop(
  session: RpcSession,
  createSocket: () => Promise<Socket>,
  listeners: RpcClientListeners,
  resolve: () => void,
  errorDelay: {value: number},
  client: {disconnectedMark: boolean},
  reconnectDelay: number
): void {
  let reconnectTimer: NodeJS.Timer = null

  function reconnect() {
    if (reconnectTimer) {
      log.warn("Spot duplicate reconnect timer")
      clearTimeout(reconnectTimer)
    }

    reconnectTimer = setTimeout(
      () =>
        connectionLoop(
          session,
          createSocket,
          listeners,
          resolve,
          errorDelay,
          client,
          reconnectDelay
        ),
      reconnectDelay + errorDelay.value
    )

    // 2nd and further reconnects are with random delays
    errorDelay.value = Math.round(Math.random() * 15 * 1000)

    if (reconnectTimer.unref) {
      reconnectTimer.unref()
    }
  }

  const l = {
    ...listeners,
    disconnected: ({code, reason}) => {
      if (!client.disconnectedMark) {
        reconnect()
      }

      listeners.disconnected({code, reason})
    },
  }

  connect(session, createSocket, l)
    .then(resolve)
    .catch(() => {
      if (!client.disconnectedMark) {
        reconnect()
      }
    })
}

function connect(
  session: RpcSession,
  createSocket: () => Promise<Socket>,
  listeners: RpcClientListeners
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const socket = await createSocket()

      let connected = false

      const timer = setTimeout(() => {
        if (!connected) reject(new Error("Connection timeout"))
      }, 10 * 1000) // 10s connection timeout

      if (timer.unref) {
        timer.unref()
      }

      socket.onOpen(() => {
        connected = true
        listeners.connected()
        session.open(socket)
        resolve()
      })

      socket.onDisconnected((code, reason) => {
        session.handleDisconnected()
        if (connected) {
          listeners.disconnected({code, reason})
        }
      })

      socket.onError(e => {
        if (!connected) {
          reject(e)
        }

        log.warn("RPC connection error", e.message)

        try {
          socket.disconnect()
        } catch (e) {
          // ignore
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
