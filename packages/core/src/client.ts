import {RpcSession} from "./RpcSession"
import {log} from "./logger"

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
}

export function createRpcClient<R = any>(level, createWebSocket, options: Partial<RpcClientOptions> = {}): Promise<RpcClient<R>> {
  const opts: RpcClientOptions = {...defaultOptions, ...options}

  const session = new RpcSession(opts.local, level, opts.listeners, {}, (ctx, next) => next())

  const client = {
    remote: session.remote,
    disconnect: () => session.terminate()
  }

  return (opts.reconnect ? startConnectionLoop : connect)(session, createWebSocket, opts.listeners)
    .then(() => client)
}

function startConnectionLoop(session: RpcSession, createWebSocket, listeners: RpcClientListeners): Promise<void> {
  return new Promise(resolve => {
    let onFirstConnection = resolve
    const errorDelay = {value: 0}

    const l = {
      ...listeners,
      connected: () => {
        // first reconnect after succesfull connection is immediate
        errorDelay.value = 0
      }
    }

    connectionLoop(session, createWebSocket, l, () => {
      onFirstConnection()
      onFirstConnection = () => {}
    }, errorDelay)
  })
}

function connectionLoop(session: RpcSession, createWebSocket, listeners: RpcClientListeners, resolve, errorDelay): void {
  connect(session, createWebSocket, listeners)
    .then(resolve)
    .catch(() => {
      const timer = setTimeout(() => connectionLoop(session, createWebSocket, listeners, resolve, errorDelay), errorDelay.value)

      // 2nd and further reconnects are with random delays
      errorDelay.value = Math.random() * 15 * 1000

      if (timer.unref) {
        timer.unref()
      }
    })
}

function connect(session: RpcSession, createWebSocket, listeners: RpcClientListeners): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = createWebSocket()

    ws.onmessage = (evt) => {
      session.handleMessage(evt.data)
    }

    ws.onerror = e => {
      ws.close()
      log.warn("WS connection error", e)
    }

    ws.onopen = () => {
      listeners.connected()
      session.open(ws)
      resolve(ws)
    }

    ws.onclose = ({code, reason}) => {
      listeners.disconnected({code, reason})
      reject()
    }
  })
}
