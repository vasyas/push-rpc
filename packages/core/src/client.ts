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
  disconnect(): void
}

export interface RpcClientOptions {
  local: any
  listeners: RpcClientListeners
  reconnect: boolean
  createContext(): RpcConnectionContext
  localMiddleware: Middleware
  remoteMiddleware: Middleware
  messageParser(data): any[]
  pingSendTimeout: number
  keepAliveTimeout: number
  callTimeout: number
  syncRemoteCalls: boolean
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
  createContext: () => ({remoteId: null}),
  localMiddleware: (ctx, next, params, messageType) => next(params),
  remoteMiddleware: (ctx, next, params, messageType) => next(params),
  messageParser: data => JSON.parse(data, dateReviver),
  pingSendTimeout: null,
  keepAliveTimeout: null,
  callTimeout: 30 * 1000,
  syncRemoteCalls: false,
}

export function createRpcClient<R = any>(
  level,
  createSocket: () => Socket,
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
    opts.syncRemoteCalls
  )

  const client = {
    disconnectedMark: false,
    remote: session.remote,
    disconnect: () => {
      client.disconnectedMark = true
      session.disconnect()
    },
  }

  return (opts.reconnect ? startConnectionLoop : connect)(
    session,
    createSocket,
    opts.listeners,
    client
  ).then(() => client)
}

function startConnectionLoop(
  session: RpcSession,
  createSocket: () => Socket,
  listeners: RpcClientListeners,
  client: {disconnectedMark: boolean}
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
    )
  })
}

function connectionLoop(
  session: RpcSession,
  createSocket: () => Socket,
  listeners: RpcClientListeners,
  resolve,
  errorDelay,
  client: {disconnectedMark: boolean}
): void {
  function reconnect() {
    const timer = setTimeout(
      () => connectionLoop(session, createSocket, listeners, resolve, errorDelay, client),
      errorDelay.value
    )

    // 2nd and further reconnects are with random delays
    errorDelay.value = Math.round(Math.random() * 15 * 1000)

    if (timer.unref) {
      timer.unref()
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
  createSocket: () => Socket,
  listeners: RpcClientListeners
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createSocket()

    let connected = false

    const timer = setTimeout(() => {
      if (!connected) reject("Connection timeout")
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
  })
}
