import {RpcSession} from "./RpcSession"
import {log} from "./logger"
import {dateReviver} from "./utils"
import {RpcConnectionContext} from "./rpc"

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
  createWebSocket,
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
    createWebSocket,
    opts.listeners
  ).then(() => client)
}

function startConnectionLoop(
  session: RpcSession,
  createWebSocket,
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
      createWebSocket,
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
  createWebSocket,
  listeners: RpcClientListeners,
  resolve,
  errorDelay
): void {
  function reconnect() {
    const timer = setTimeout(
      () => connectionLoop(session, createWebSocket, listeners, resolve, errorDelay),
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

  connect(session, createWebSocket, l)
    .then(resolve)
    .catch(() => {
      reconnect()
    })
}

function connect(
  session: RpcSession,
  createWebSocket,
  listeners: RpcClientListeners
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = createWebSocket()

    let connected = false

    const timer = setTimeout(() => {
      if (!connected) reject("Connection timeout")
    }, 10 * 1000) // 10s connection timeout

    if (timer.unref) {
      timer.unref()
    }

    ws.onmessage = evt => {
      session.handleMessage(evt.data)
    }

    ws.onerror = e => {
      if (!connected) {
        reject(e)
      }

      ws.close()
      log.warn("WS connection error", e.message)
    }

    ws.onopen = () => {
      connected = true
      listeners.connected()
      session.open(ws)
      resolve(ws)
    }

    ws.onclose = ({code, reason}) => {
      session.close()
      if (connected) {
        listeners.disconnected({code, reason})
      }
    }
  })
}
