import * as WebSocket from "ws"
import {log} from "./logger"
import {dateReviver, message} from "./utils"
import {getServiceItem, MessageType, RemoteMethod} from "./rpc"
import {ServerTopicImpl} from "./server"

export class RpcSession {
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