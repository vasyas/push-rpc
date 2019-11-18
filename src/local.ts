import * as UUID from "uuid-js"
import * as WebSocket from "ws"
import {DataConsumer, DataSupplier, MessageType, Topic, TopicImpl} from "./rpc"
import {log} from "./logger"
import {createMessageId} from "./utils"
import {RpcSession} from "./RpcSession"
import {createRemote} from "./remote"

/** LocalTopicImpl should implement Topic (and RemoteTopic) so it could be used in ServiceImpl */
export class LocalTopicImpl<D, P> extends TopicImpl implements Topic<D, P> {
  constructor(private supplier: DataSupplier<D, P>) {
    super()
  }

  name: string

  trigger(params: P = null, suppliedData?: D): void {
    const key = JSON.stringify(params)

    const subscribed: RpcSession[] = this.subscribedSessions[key] || []

    // data cannot be cached between subscribers, b/c for dfferent subscriber there could be a different context
    subscribed.forEach(async session => {
      const data: D = suppliedData != undefined
        ? suppliedData
        : await this.supplier(params, session.createContext())

      session.send(MessageType.Data, createMessageId(), this.name, params, data)
    })
  }

  async getData(params: P, ctx: any): Promise<D> {
    return await this.supplier(params, ctx)
  }

  async subscribeSession(session: RpcSession, params: P) {
    const key = JSON.stringify(params)

    const sessions = this.subscribedSessions[key] || []

    // no double subscribe
    if (sessions.indexOf(session) >= 0) return

    sessions.push(session)
    this.subscribedSessions[key] = sessions

    if (this.supplier) {
      const data = await this.supplier(params, session.createContext())
      session.send(MessageType.Data, createMessageId(), this.name, params, data)
    }
  }

  unsubscribeSession(session: RpcSession, params: P) {
    const key = JSON.stringify(params)

    const sessions = this.subscribedSessions[key]

    if (!sessions) return

    const index = sessions.indexOf(session)
    sessions.splice(index, 1)

    if (!sessions.length) {
      delete this.subscribedSessions[key]
    }
  }

  private subscribedSessions: {[key: string]: RpcSession[]} = {}

  // dummy implementations, see class comment

  get(params?: P): Promise<D> { return undefined; }
  subscribe(consumer: DataConsumer<D>, params: P, subscriptionKey: any): void {}
  unsubscribe(params?: P, subscriptionKey?: any) {}
}

export interface Options {
  wss?: any
  createContext?(req, protocol: string, remoteId: string): any
  localMiddleware?: (ctx, next) => Promise<any>
  getClientId?: (req) => string
  clientLevel?: number

  listeners?: {
    connected?(remoteId: string, connections: number): void
    disconnected?(remoteId: string, connections: number): void
    messageIn(remoteId: string, data: string)
    messageOut(remoteId: string, data: string)
    subscribed(subscriptions: number)
    unsubscribed(subscriptions: number)
  }
}


const defaultOptions: Partial<Options> = {
  wss: {noServer: true},
  createContext: (req, protocol, remoteId) => ({protocol, remoteId}),
  localMiddleware: (ctx, next) => next(),
  getClientId: () => UUID.create().toString(),
  clientLevel: 0,
  listeners: {
    connected: () => {},
    disconnected: () => {},
    subscribed: () => {},
    unsubscribed: () => {},
    messageIn: () => {},
    messageOut: () => {},
  },
}

export function createRpcServer(local: any, opts: Options = {}) {
  opts = {
    ...defaultOptions,
    ...opts
  }

  const wss = new WebSocket.Server(opts.wss)
  const sessions: {[clientId: string]: RpcSession} = {}

  prepareLocal(local)

  wss.on("error", e => {
    log.error("RPC WS server error", e)
  })

  setInterval(() => {
    Object.values(sessions).forEach(session => session.checkAlive())
  }, 15 * 1000).unref()

  function getTotalSubscriptions() {
    return Object.values(sessions).map(s => s.subscriptions.length).reduce(((p, c) => p + c), 0)
  }

  wss.on("connection", (ws, req) => {
    const remoteId = opts.getClientId(req)
    const protocol = req.headers["sec-websocket-protocol"] ? req.headers["sec-websocket-protocol"][0] : null

    const connectionContext = opts.createContext(req, protocol, remoteId)
    const session = new RpcSession(local, opts.clientLevel, {
      messageIn: data => opts.listeners.messageIn(remoteId, data),
      messageOut: data => opts.listeners.messageOut(remoteId, data),
      subscribed: () => opts.listeners.subscribed(getTotalSubscriptions()),
      unsubscribed: () => opts.listeners.unsubscribed(getTotalSubscriptions()),
    }, connectionContext, opts.localMiddleware)

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
      await session.remove()

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
    getRemote: (clientId) => {
      if (!sessions[clientId])
        throw new Error(`Client ${clientId} is not connected`)

      return createRemote(opts.clientLevel, sessions[clientId])
    },
    isConnected: (remoteId) => {
      return !!sessions[remoteId]
    }
  }
}

/**
 * 1. Set name on topics
 * 2. Bind this to remote methods
 */
function prepareLocal(services, prefix = "") {
  const keys = [
    ...Object.keys(services),
    ...(Object.getPrototypeOf(services) && Object.keys(Object.getPrototypeOf(services)) || []),
  ]

  keys.forEach(key => {
    const item = services[key]

    if (typeof item == "object") {
      const name = prefix + "/" + key

      if (item instanceof LocalTopicImpl) {
        item.name = name
        return
      }

      return prepareLocal(item, name)
    } else if (typeof item == "function") {
      services[key] = item.bind(services)
    }
  })
}