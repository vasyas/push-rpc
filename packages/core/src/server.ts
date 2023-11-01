import * as UUID from "uuid-js"
import {log} from "./logger"
import {RpcSession} from "./RpcSession"
import {createRemote} from "./remote"
import {prepareLocal} from "./local"
import {dateReviver, safeListener} from "./utils"
import {Middleware, RpcConnectionContext} from "./rpc"
import {Socket, SocketServer} from "./transport"

export interface RpcServerOptions {
  createConnectionContext?(socket: Socket, ...transportDetails: any): Promise<RpcConnectionContext>
  localMiddleware?: Middleware
  remoteMiddleware?: Middleware
  messageParser?(data): any[]
  pingSendTimeout?: number
  keepAliveTimeout?: number
  callTimeout?: number
  syncRemoteCalls?: boolean
  delayCalls?: number

  listeners?: {
    connected?(remoteId: string, connections: number, ctx: RpcConnectionContext): void
    disconnected?(remoteId: string, connections: number, ctx: RpcConnectionContext): void
    messageIn(remoteId: string, data: string, ctx: RpcConnectionContext)
    messageOut(remoteId: string, data: string, ctx: RpcConnectionContext)
    subscribed(subscriptions: number, ctx: RpcConnectionContext)
    unsubscribed(subscriptions: number, ctx: RpcConnectionContext)
  }
}

const defaultOptions: Partial<RpcServerOptions> = {
  createConnectionContext: async (socket, ...transportDetails) => ({
    remoteId: UUID.create().toString(),
  }),
  localMiddleware: (ctx, next, params, messageType) => next(params),
  remoteMiddleware: (ctx, next, params, messageType) => next(params),
  pingSendTimeout: 40 * 1000,
  keepAliveTimeout: 120 * 1000,
  callTimeout: 15 * 1000,
  syncRemoteCalls: false,
  delayCalls: 0,
  messageParser: data => JSON.parse(data, dateReviver),
  listeners: {
    connected: () => {},
    disconnected: () => {},
    subscribed: () => {},
    unsubscribed: () => {},
    messageIn: () => {},
    messageOut: () => {},
  },
}

export interface RpcServer {
  getRemote(remoteId: string): any
  isConnected(remoteId: string): boolean
  getConnectedIds(): string[]
  close(cb): void
  disconnectClient(remoteId: string): Promise<void>
}

export function createRpcServer(
  local: any,
  socketServer: SocketServer,
  opts: RpcServerOptions = {}
): RpcServer {
  opts = {
    ...defaultOptions,
    ...opts,
  }

  const sessions: {[clientId: string]: RpcSession} = {}

  prepareLocal(local)

  socketServer.onError(e => {
    log.error("RPC WS server error", e)
  })

  function getTotalSubscriptions() {
    return Object.values(sessions)
      .map(s => s.subscriptions.length)
      .reduce((p, c) => p + c, 0)
  }

  function isConnected(remoteId) {
    return !!sessions[remoteId]
  }

  socketServer.onConnection(async (socket, ...transportDetails) => {
    let connectionContext

    try {
      connectionContext = await opts.createConnectionContext(socket, ...transportDetails)
    } catch (e) {
      log.warn("Failed to create connection context", e)
      socket.disconnect()
      return
    }

    const {remoteId} = connectionContext

    if (sessions[remoteId]) {
      log.warn("Prev session active, disconnecting", remoteId)
      await sessions[remoteId].disconnect()
    }

    const session = new RpcSession(
      local,
      {
        messageIn: data =>
          safeListener(() => opts.listeners.messageIn(remoteId, data, connectionContext)),
        messageOut: data =>
          safeListener(() => opts.listeners.messageOut(remoteId, data, connectionContext)),
        subscribed: () =>
          safeListener(() => opts.listeners.subscribed(getTotalSubscriptions(), connectionContext)),
        unsubscribed: () =>
          safeListener(() =>
            opts.listeners.unsubscribed(getTotalSubscriptions(), connectionContext)
          ),
      },
      connectionContext,
      opts.localMiddleware,
      opts.remoteMiddleware,
      opts.messageParser,
      opts.pingSendTimeout,
      opts.keepAliveTimeout,
      opts.callTimeout,
      opts.syncRemoteCalls,
      opts.delayCalls
    )
    sessions[remoteId] = session

    session.open(socket)

    safeListener(() =>
      opts.listeners.connected(remoteId, Object.keys(sessions).length, connectionContext)
    )

    socket.onDisconnected(async (code, reason) => {
      if (sessions[remoteId] == session) {
        delete sessions[remoteId]

        log.debug(`Client disconnected, ${remoteId}`, {code, reason})
      } else {
        log.debug(`Disconnected prev session, ${remoteId}`, {code, reason})
      }

      safeListener(() =>
        opts.listeners.disconnected(remoteId, Object.keys(sessions).length, connectionContext)
      )

      await session.handleDisconnected()
    })

    socket.onError(e => {
      log.warn(`Communication error, client ${remoteId}`, e)
    })
  }, isConnected)

  return {
    close: cb => socketServer.close(cb),

    /** These remote are not reconnecting - they should not be saved */
    getRemote: clientId => {
      if (!sessions[clientId]) throw new Error(`Client ${clientId} is not connected`)

      return createRemote(sessions[clientId])
    },
    isConnected,
    getConnectedIds: () => Object.keys(sessions),
    disconnectClient: async clientId => {
      if (!sessions[clientId]) throw new Error(`Client ${clientId} is not connected`)

      await sessions[clientId].disconnect()
    },

    // for debug only
    __sessions: sessions,
  } as any
}
