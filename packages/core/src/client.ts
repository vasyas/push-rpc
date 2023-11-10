import {RpcSession} from "./RpcSession"
import {log} from "./logger"
import {dateReviver, safeListener} from "./utils"
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

export interface RpcClientOptions {
  local: any
  listeners: RpcClientListeners
  reconnect: boolean
  reconnectDelay: number
  errorDelayMaxDuration: number
  createContext(): RpcConnectionContext
  localMiddleware: Middleware
  remoteMiddleware: Middleware
  messageParser(data): any[]
  pingSendTimeout: number
  keepAliveTimeout: number
  callTimeout: number
  syncRemoteCalls: boolean
  delayCalls: number
  connectionTimeout: number
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
  errorDelayMaxDuration: 15 * 1000,
  createContext: () => ({remoteId: null}),
  localMiddleware: (ctx, next, params, messageType) => next(params),
  remoteMiddleware: (ctx, next, params, messageType) => next(params),
  messageParser: data => JSON.parse(data, dateReviver),
  pingSendTimeout: null,
  keepAliveTimeout: null,
  callTimeout: 30 * 1000,
  syncRemoteCalls: true,
  delayCalls: 0,
  connectionTimeout: 10 * 1000,
}

export class RpcClient<R> {
  public remote: R

  constructor(
    private session: RpcSession,
    private createSocket: () => Promise<Socket>,
    private opts: RpcClientOptions
  ) {
    this.remote = session.remote
  }

  private disconnectedMark = false

  async disconnect(): Promise<void> {
    this.disconnectedMark = true
    await this.session.disconnect()
  }

  /**
   * Connect this to server
   *
   * Resolves on successful connection, rejects on connection error or connection timeout (10s)
   */
  async connect(onDisconnected: () => void = () => {}): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const socket = await this.createSocket()

        let connected = false

        if (this.opts.connectionTimeout) {
          const timer = setTimeout(() => {
            if (!connected) {
              socket.disconnect()
              reject(new Error("Connection timeout"))
            }
          }, this.opts.connectionTimeout)

          if (timer.unref) {
            timer.unref()
          }
        }

        socket.onOpen(() => {
          connected = true
          safeListener(() => this.opts.listeners.connected())
          this.session.open(socket)
          resolve()
        })

        socket.onDisconnected((code, reason) => {
          this.session.handleDisconnected()

          if (connected) {
            onDisconnected()
            safeListener(() => this.opts.listeners.disconnected({code, reason}))
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

  /**
   * Connect to the server, on each disconnect try to disconnect.
   * Resolves at first successful connect. Reconnection loop continues even after resolution
   * Never rejects
   */
  connectionLoop() {
    return new Promise<void>(async resolve => {
      let onFirstConnection = resolve
      let errorDelay = 0

      while (true) {
        // connect, and wait for ...
        await new Promise<void>(resolve => {
          // 1. ...disconnected
          const connectionPromise = this.connect(resolve)

          connectionPromise.then(
            () => {
              // first reconnect after successful connection is done without delay
              errorDelay = 0

              // signal about first connection
              onFirstConnection()
              onFirstConnection = () => {}
            },
            () => {
              // 2. ... unable to establish connection
              resolve()
            }
          )
        })

        if (this.disconnectedMark) {
          return
        }

        await new Promise(r => {
          setTimeout(r, this.opts.reconnectDelay + errorDelay)
        })

        errorDelay = Math.round(Math.random() * this.opts.errorDelayMaxDuration)
      }
    })
  }
}

export async function createRpcClient<R = any>(
  createSocket: () => Promise<Socket>,
  options: Partial<RpcClientOptions> = {}
): Promise<RpcClient<R>> {
  const opts: RpcClientOptions = {...defaultOptions, ...options}

  const session = new RpcSession(
    opts.local,
    {
      messageIn: data => safeListener(() => opts.listeners.messageIn(data)),
      messageOut: data => safeListener(() => opts.listeners.messageOut(data)),
      subscribed: subs => safeListener(() => opts.listeners.subscribed(subs)),
      unsubscribed: subs => safeListener(() => opts.listeners.unsubscribed(subs)),
    },
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

  const client = new RpcClient<R>(session, createSocket, opts)

  if (opts.reconnect) {
    await client.connectionLoop()
  } else {
    await client.connect()
  }

  return client
}
