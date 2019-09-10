import * as WebSocket from "ws"
import {DataSupplier, getServiceItem, RemoteMethod, RequestType, Services, Topic, TopicImpl} from "./rpc"
import {log} from "./logger"
import {dateReviver} from "./utils"

export class ServerTopicImpl<P, D> extends TopicImpl<P, D> implements Topic<P, D> {
  constructor(private supplier: DataSupplier<P, D>) {
    super()
  }

  name: string

  trigger(params: P, suppliedData?: D) {
    const key = JSON.stringify(params)

    const subscribed: RpcSession[] = this.subscribedSessions[key] || []

    subscribed.forEach(async session => {
      const data: D = suppliedData != undefined
        ? suppliedData
        : await this.supplier(params, session.context)

      session.send(this.name, params, data)
    })
  }

  async subscribe(params, session) {
    const key = JSON.stringify(params)

    const sessions = this.subscribedSessions[key] || []

    // no double subscribe
    if (sessions.indexOf(session) >= 0) return

    sessions.push(session)
    this.subscribedSessions[key] = sessions

    if (this.supplier) {
      const data = await this.supplier(params, session.context)
      session.send(this.name, params, data)
    }
  }

  unsubscribe(params, session) {
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
}

let services: Services = {}

export function createRpcServer(
  servicesImpl: any,
  server: WebSocket.Server,
  createContext: (req) => any = () => {},
): WebSocket.Server {
  services = servicesImpl
  prepareServiceImpl(services)

  server.on("error", e => {
    log.error("RPC WS server error", e)
  })

  setInterval(() => {
    sessions.forEach(session => session.checkAlive())
  }, 15 * 1000)

  server.on("connection", (ws, req) => {
    const session = new RpcSession(ws, createContext(req))

    sessions.push(session)
    rpcMetrics()

    ws.on("message", message => {
      session.handleMessage(message)
    })

    ws.on("close", async () => {
      await session.remove()
    })

    ws.on("error", e => {
      log.error("Data WS error", e)
    })
  })

  return server
}

const sessions: RpcSession[] = []

class RpcSession {
  constructor(private ws: WebSocket, public context) {
    ws.on("pong", () => {
      log.debug("Got pong")

      this.alive = true
    })
  }

  async remove() {
    await this.unsubscribeAll()

    const index = sessions.indexOf(this)

    if (index >= 0) {
      sessions.splice(index, 1)
      rpcMetrics()
    }
  }

  private alive = true

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

  async handleMessage(data) {
    try {
      const [type, topicName, params] = JSON.parse(data, dateReviver)

      const item = getServiceItem(services, topicName)

      if (!item) {
        throw new Error(`Can't find item with name ${topicName}`)
      }

      switch (type) {
        case RequestType.Subscribe:
          await this.subscribe(item, params)
          break

        case RequestType.Unsubscribe:
          await this.unsubscribe(item, params)
          break

        case RequestType.Call:
          const remoteMethod = item as RemoteMethod
          await remoteMethod(params)
          break
      }
    } catch (e) {
      log.error(`Failed to handle RPC message ${data}\n`, e)
    }
  }

  send(topicName, params, data) {
    const message = JSON.stringify([topicName, params, data])
    this.ws.send(message)
  }

  private async subscribe(topic, params) {
    await topic.subscribe(params, this)
    this.subscriptions.push({topic, params})
    rpcMetrics()
  }

  private async unsubscribe(topic, params) {9
    await topic.unsubscribe(params, this)

    const paramsKey = JSON.stringify(params)

    this.subscriptions = this.subscriptions.filter(s => s.topic != topic || JSON.stringify(s.params) != paramsKey)
    rpcMetrics()
  }

  private async unsubscribeAll() {
    await Promise.all(this.subscriptions.map(s => s.topic.unsubscribe(s.params, this)))
    this.subscriptions = []
    rpcMetrics()
  }

  subscriptions: {topic, params}[] = []
}

function rpcMetrics() {
  const subscriptions = sessions
    .map(session => session.subscriptions.length)
    .reduce((r, count) => r + count, 0)

  log.debug("\n", [
    {name: "data.websockets", value: sessions.length, unit: "Count"},
    {name: "data.subscriptions", value: subscriptions, unit: "Count"},
  ])
}

/**
 * 1. Set name on topics
 * 2. Bind this to remote methods
 */
function prepareServiceImpl(services, prefix = "") {
  // TODO walk down proto chain to get methods from superclasses
  const keys = [
    ...Object.keys(services),
    ...(Object.getPrototypeOf(services) && Object.keys(Object.getPrototypeOf(services)) || []),
  ]

  keys.forEach(key => {
    const i = services[key]

    if (typeof i == "object") {
      const name = prefix + "/" + key

      if (i instanceof ServerTopicImpl) {
        i.name = name
        return
      }

      return prepareServiceImpl(i, name)
    } else if (typeof i == "function") {
      services[key] = services[key].bind(services)
    }
  })
}