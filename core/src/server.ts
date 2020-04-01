import * as UUID from "uuid-js"
import {log} from "./logger"
import {RpcSession} from "./RpcSession"
import {createRemote} from "./remote"
import {prepareLocal} from "./local"
import {dateReviver} from "./utils"
import {Middleware, RpcConnectionContext} from "./rpc"
import {Socket, SocketServer} from "./transport"

export interface RpcServerOptions {
  createConnectionContext?(socket: Socket, ...transportDetails: any): Promise<RpcConnectionContext>
  localMiddleware?: Middleware
  remoteMiddleware?: Middleware
  clientLevel?: number
  messageParser?(data): any[]
  pingSendTimeout?: number
  pongWaitTimeout?: number
  callTimeout?: number
  syncRemoteCalls?: boolean

  getKeepAliveSettings?(
    connectionContext: RpcConnectionContext
  ): {pingSendTimeout: number; pongWaitTimeout: number}

  listeners?: {
    connected?(remoteId: string, connections: number): void
    disconnected?(remoteId: string, connections: number): void
    messageIn(remoteId: string, data: string)
    messageOut(remoteId: string, data: string)
    subscribed(subscriptions: number)
    unsubscribed(subscriptions: number)
  }
}

const defaultOptions: Partial<RpcServerOptions> = {
  createConnectionContext: async (socket, ...transportDetails) => ({
    remoteId: UUID.create().toString(),
  }),
  localMiddleware: (ctx, next, params) => next(params),
  remoteMiddleware: (ctx, next, params) => next(params),
  clientLevel: 0,
  pingSendTimeout: 50 * 1000,
  pongWaitTimeout: 25 * 1000,
  callTimeout: 30 * 1000,
  syncRemoteCalls: false,
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
      socket.terminate()
      return
    }

    const {remoteId} = connectionContext

    const keepAliveSettings = opts.getKeepAliveSettings
      ? opts.getKeepAliveSettings(connectionContext)
      : {pingSendTimeout: opts.pingSendTimeout, pongWaitTimeout: opts.pongWaitTimeout}

    const session = new RpcSession(
      local,
      opts.clientLevel,
      {
        messageIn: data => opts.listeners.messageIn(remoteId, data),
        messageOut: data => opts.listeners.messageOut(remoteId, data),
        subscribed: () => opts.listeners.subscribed(getTotalSubscriptions()),
        unsubscribed: () => opts.listeners.unsubscribed(getTotalSubscriptions()),
      },
      connectionContext,
      opts.localMiddleware,
      opts.remoteMiddleware,
      opts.messageParser,
      keepAliveSettings.pingSendTimeout,
      keepAliveSettings.pongWaitTimeout,
      opts.callTimeout,
      opts.syncRemoteCalls
    )

    session.open(socket)

    if (sessions[remoteId]) {
      log.warn("Prev session active, discarding", remoteId)
      sessions[remoteId].terminate()
    }
    sessions[remoteId] = session

    opts.listeners.connected(remoteId, Object.keys(sessions).length)

    socket.onMessage(message => {
      session.handleMessage(message)
    })

    socket.onClose(async (code, reason) => {
      await session.close()

      if (sessions[remoteId] == session) {
        delete sessions[remoteId]

        log.debug(`Client disconnected, ${remoteId}`, {code, reason})
      } else {
        log.debug(`Disconnected prev session, ${remoteId}`, {code, reason})
      }

      opts.listeners.disconnected(remoteId, Object.keys(sessions).length)
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

      return createRemote(opts.clientLevel, sessions[clientId])
    },
    isConnected,
    getConnectedIds: () => Object.keys(sessions),
  }
}
