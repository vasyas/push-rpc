import * as UUID from "uuid-js"
import * as WebSocket from "ws"
import {log} from "./logger"
import {RpcSession} from "./RpcSession"
import {createRemote} from "./remote"
import {prepareLocal} from "./local"
import {dateReviver} from "./utils"
import {RpcConnectionContext} from "./rpc"

export interface RpcServerOptions {
  wss?: any
  createContext?(req): RpcConnectionContext
  localMiddleware?: (ctx, next) => Promise<any>
  clientLevel?: number
  messageParser?(data): any[]
  keepAlivePeriod?: number
  syncRemoteCalls?: boolean

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
  wss: {noServer: true},
  createContext: req => ({remoteId: UUID.create().toString()}),
  localMiddleware: (ctx, next) => next(),
  clientLevel: 0,
  keepAlivePeriod: 50 * 1000,
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
  wss: WebSocket.Server
  getRemote(remoteId: string): any
  isConnected(remoteId: string): boolean
}

export function createRpcServer(local: any, opts: RpcServerOptions = {}): RpcServer {
  opts = {
    ...defaultOptions,
    ...opts,
  }

  const wss = new WebSocket.Server(opts.wss)
  const sessions: {[clientId: string]: RpcSession} = {}

  prepareLocal(local)

  wss.on("error", e => {
    log.error("RPC WS server error", e)
  })

  function getTotalSubscriptions() {
    return Object.values(sessions)
      .map(s => s.subscriptions.length)
      .reduce((p, c) => p + c, 0)
  }

  wss.on("connection", (ws, req) => {
    const connectionContext = opts.createContext(req)
    const {remoteId} = connectionContext

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
      opts.messageParser,
      opts.keepAlivePeriod,
      opts.syncRemoteCalls
    )

    session.open(ws)

    if (sessions[remoteId]) {
      log.warn("Prev session active, discarding", remoteId)
      sessions[remoteId].terminate()
    }
    sessions[remoteId] = session

    opts.listeners.connected(remoteId, Object.keys(sessions).length)

    ws.on("message", message => {
      session.handleMessage(message)
    })

    ws.on("close", async (code, reason) => {
      await session.close()

      if (sessions[remoteId] == session) {
        delete sessions[remoteId]

        log.debug(`Client disconnected, ${remoteId}`, {code, reason})
      } else {
        log.debug(`Disconnected prev session, ${remoteId}`, {code, reason})
      }

      opts.listeners.disconnected(remoteId, Object.keys(sessions).length)
    })

    ws.on("error", e => {
      log.warn(`Communication error, client ${remoteId}`, e)
    })
  })

  return {
    wss,
    getRemote: clientId => {
      if (!sessions[clientId]) throw new Error(`Client ${clientId} is not connected`)

      return createRemote(opts.clientLevel, sessions[clientId])
    },
    isConnected: remoteId => {
      return !!sessions[remoteId]
    },
  }
}
