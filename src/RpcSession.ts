import * as WebSocket from "ws"
import {log} from "./logger"
import {createMessageId, dateReviver, message} from "./utils"
import {getServiceItem, MessageType, Method} from "./rpc"
import {LocalTopicImpl} from "./local"
import {RemoteTopicImpl, createRemote} from "./remote"

export class RpcSession {
  constructor(
    private local: any,
    private remoteLevel: number,
    private updateMetrics,
    private connectionContext: any,
    private caller: (ctx, next) => Promise<any>
  ) {
  }



  open(ws) {
    this.ws = ws
    // TODO close previous?

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
      log.debug("In", data)

      const message = JSON.parse(data, dateReviver)

      if (message[0] == MessageType.Result || message[0] == MessageType.Error) {
        return this.callRemoteResponse(message)
      }

      const [type, id, name, ...other] = message

      const item = getServiceItem(this.local, name)

      if (!item) {
        throw new Error(`Can't find item with name ${name}`)
      }

      const serverTopic = item as any as LocalTopicImpl<any, any>
      const clientTopic = item as any as RemoteTopicImpl<any, any>
      const method = item as Method

      switch (type) {
        case MessageType.Subscribe:
          this.subscribe(serverTopic, other[0])
          break

        case MessageType.Unsubscribe:
          this.unsubscribe(serverTopic, other[0])
          break

        case MessageType.Get:
          this.get(id, serverTopic, other[0])
          break

        case MessageType.Call:
          this.callLocal(id, method, other[0])
          break

        case MessageType.Data:
          clientTopic.receiveData(other[0], other[1])
          break
      }
    } catch (e) {
      log.error(`Failed to handle RPC message ${data}\n`, e)
    }
  }

  send(type: MessageType, id: string, ...params) {
    const m = message(type, id, ...params)
    log.debug("Out", m)
    this.ws.send(m)
  }

  callRemote(name, params, type) {
    return new Promise((resolve, reject) => {
      const id = createMessageId()
      this.calls[id] = {resolve, reject}
      this.send(type, id, name, params)
    })
  }

  /** Creates call context - context to be used in calls */
  public createContext() {
    return {
      ...this.connectionContext,
      remote: createRemote(this.remoteLevel, this)
    }
  }

  private callRemoteResponse(data) {
    const [_, id, res] = data

    if (this.calls[id]) {
      const {resolve, reject} = this.calls[id]
      delete this.calls[id]

      if (data[0] == MessageType.Result) {
        resolve(res)
      } else {
        reject(res)
      }
    }
  }

  private async callLocal(id, remoteMethod, params) {
    try {
      const callContext = this.createContext()
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

  private async get(id, topic: LocalTopicImpl<any, any>, params) {
    try {
      const d = await topic.getData(params, this.createContext())
      this.send(MessageType.Result, id, d)
    } catch (e) {
      const err = Object.getOwnPropertyNames(e)
        .filter(e => e != "stack")
        .reduce((r, key) => ({...r, [key]: e[key]}), {})

      this.send(MessageType.Error, id, err)
    }
  }

  private async subscribe(topic: LocalTopicImpl<any, any>, params) {
    await topic.subscribeSession(this, params)
    this.subscriptions.push({topic, params})
    this.updateMetrics()
  }

  private async unsubscribe(topic: LocalTopicImpl<any, any>, params) {
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

  private ws: WebSocket = null

  public subscriptions: {topic, params}[] = []

  // both remote method calls and topics get
  // TODO reject on timeout, expire calls cache
  private calls: {[id: string]: {resolve, reject}} = {}
}