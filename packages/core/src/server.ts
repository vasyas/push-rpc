import * as UUID from "uuid-js"
import * as WebSocket from "ws"
import {
  DataConsumer,
  DataSupplier,
  getServiceItem,
  MessageType,
  RemoteMethod,
  RpcContext,
  Services,
  Topic,
  TopicImpl
} from "./rpc"
import {log} from "./logger"
import {createMessageId, dateReviver, message} from "./utils"

/** ServerTopicImpl should implement Topic (and ClientTopic) so it could be used in ServiceImpl */
export class ServerTopicImpl<D, P> extends TopicImpl implements Topic<D, P> {
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
        : await this.supplier(params, session.context)

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
      const data = await this.supplier(params, session.context)
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

interface Options {
  wss?: any
  createContext?: (req, ctx: RpcContext) => any
  caller?: (ctx, next) => Promise<any>
  getClientId?: (req) => string
}

const defaultOptions: Partial<Options> = {
  wss: {noServer: true},
  createContext: (req, ctx) => ctx,
  caller: (ctx, next) => next(),
  getClientId: () => UUID.create().toString()
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

  wss.on("connection", (ws, req) => {
    const clientId = opts.getClientId(req)

    const ctx: RpcContext = {}
    const session = new RpcSession(ws, local, () => rpcMetrics(sessions), opts.createContext(req, ctx), opts.caller)

    // const protocol = req.headers["sec-websocket-protocol"]
    // log.debug(`Client ${clientId} connected, protocol ${protocol}`)

    if (sessions[clientId]) {
      log.warn("Prev session active, discarding", clientId)
      sessions[clientId].terminate()
    }
    sessions[clientId] = session

    rpcMetrics(sessions)

    ws.on("message", message => {
      session.handleMessage(message)
    })

    ws.on("close", async (code, reason) => {
      await session.remove()

      if (sessions[clientId] == session) {
        delete sessions[clientId]

        log.debug(`Client disconnected, ${clientId}`, {code, reason})
      } else {
        log.debug(`Disconnected prev session, ${clientId}`, {code, reason})
      }

      rpcMetrics(sessions)
    })

    ws.on("error", e => {
      log.warn(`Communication error, client ${clientId}`, e)
    })
  })
}

class RpcSession {
  constructor(private ws: WebSocket, private local: any, private updateMetrics, public context, private caller: (ctx, next) => Promise<any>) {
    ws.on("pong", () => {
      log.debug("Got pong")

      this.alive = true
    })
  }

  async remove() {
    await this.unsubscribeAll()
  }

  private alive = true

  terminate() {
    this.ws.terminate()
  }

  checkAlive() {
    if (!this.alive) {
      log.warn(`RpcSession keep alive check failed`)

      this.ws.terminate()
    } else {
      this.alive = false

      try {
        log.debug("Send ping")
        this.ws.ping()
      } catch (e) {
        log.debug("Send ping failed", e)
      }
    }
  }

  handleMessage(data) {
    try {
      log.debug("Server in", data)

      const [type, id, name, params] = JSON.parse(data, dateReviver)

      const item = getServiceItem(this.local, name)

      if (!item) {
        throw new Error(`Can't find item with name ${name}`)
      }

      const topic = item as any as ServerTopicImpl<any, any>
      const method = item as RemoteMethod

      switch (type) {
        case MessageType.Subscribe:
          this.subscribe(topic, params)
          break

        case MessageType.Unsubscribe:
          this.unsubscribe(topic, params)
          break

        case MessageType.Get:
          this.get(id, topic, params)
          break

        case MessageType.Call:
          this.call(id, method, params)
          break
      }
    } catch (e) {
      log.error(`Failed to handle RPC message ${data}\n`, e)
    }
  }

  send(type: MessageType, id: string, ...params) {
    const m = message(type, id, ...params)
    log.debug("Server out", m)
    this.ws.send(m)
  }

  private async call(id, remoteMethod, params) {
    try {
      const callContext = {...this.context}
      const r = await this.caller(callContext, () => remoteMethod(params, callContext))

      this.send(MessageType.Result, id, r)
    } catch (e) {
      log.error("Unable to call RPC. ", e)

      const err = Object.getOwnPropertyNames(e)
        .filter(e => e != "stack")
        .reduce((r, key) => ({...r, [key]: e[key]}), {})

      this.send(MessageType.Error, id, err)
    }
  }

  private async get(id, topic: ServerTopicImpl<any, any>, params) {
    try {
      const d = await topic.getData(params, this.context)
      this.send(MessageType.Result, id, d)
    } catch (e) {
      const err = Object.getOwnPropertyNames(e)
        .filter(e => e != "stack")
        .reduce((r, key) => ({...r, [key]: e[key]}), {})

      this.send(MessageType.Error, id, err)
    }
  }

  private async subscribe(topic: ServerTopicImpl<any, any>, params) {
    await topic.subscribeSession(this, params)
    this.subscriptions.push({topic, params})
    this.updateMetrics()
  }

  private async unsubscribe(topic: ServerTopicImpl<any, any>, params) {
    await topic.unsubscribeSession(this, params)

    const paramsKey = JSON.stringify(params)

    this.subscriptions = this.subscriptions.filter(s => s.topic != topic || JSON.stringify(s.params) != paramsKey)
    this.updateMetrics()
  }

  private async unsubscribeAll() {
    await Promise.all(this.subscriptions.map(s => s.topic.unsubscribeSession(this, s.params)))
    this.subscriptions = []
    this.updateMetrics()
  }

  subscriptions: {topic, params}[] = []
}

function rpcMetrics(sessions: {[id: string]: RpcSession}) {
  const subscriptions = Object.values(sessions)
    .map(session => session.subscriptions.length)
    .reduce((r, count) => r + count, 0)

  log.debug("\n", [
    {name: "rpc.websockets", value: sessions.length, unit: "Count"},
    {name: "rpc.subscriptions", value: subscriptions, unit: "Count"},
  ])
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

      if (item instanceof ServerTopicImpl) {
        item.name = name
        return
      }

      return prepareLocal(item, name)
    } else if (typeof item == "function") {
      services[key] = item.bind(services)
    }
  })
}