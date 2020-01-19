import {RpcSession} from "./RpcSession"
import {log} from "./logger"
import {dateReviver} from "./utils"
import {RpcConnectionContext} from "./rpc"
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
  localMiddleware: (ctx, next) => Promise<any>
  messageParser(data): any[]
  keepAlivePeriod: number
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
  localMiddleware: (ctx, next) => next(),
  messageParser: data => JSON.parse(data, dateReviver),
  keepAlivePeriod: null,
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
    opts.messageParser,
    opts.keepAlivePeriod,
    opts.syncRemoteCalls
  )

  const client = {
    remote: session.remote,
    disconnect: () => session.terminate(),
  }

  return (opts.reconnect ? startConnectionLoop : connect)(
    session,
    createSocket,
    opts.listeners
  ).then(() => client)
}

function startConnectionLoop(
  session: RpcSession,
  createSocket: () => Socket,
  listeners: RpcClientListeners
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
      errorDelay
    )
  })
}

function connectionLoop(
  session: RpcSession,
  createSocket: () => Socket,
  listeners: RpcClientListeners,
  resolve,
  errorDelay
): void {
  function reconnect() {
    const timer = setTimeout(
      () => connectionLoop(session, createSocket, listeners, resolve, errorDelay),
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
      reconnect()
      listeners.disconnected({code, reason})
    },
  }

  connect(session, createSocket, l)
    .then(resolve)
    .catch(() => {
      reconnect()
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

    socket.onMessage(data => {
      session.handleMessage(data)
    })

    socket.onError(e => {
      if (!connected) {
        reject(e)
      }

      socket.terminate()
      log.warn("RPC connection error", e.message)
    })

    socket.onOpen(() => {
      connected = true
      listeners.connected()
      session.open(socket)
      resolve()
    })

    socket.onClose(({code, reason}) => {
      session.close()
      if (connected) {
        listeners.disconnected({code, reason})
      }
    })
  })
}
