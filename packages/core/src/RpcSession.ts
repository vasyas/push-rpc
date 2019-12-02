import {log} from "./logger"
import {createMessageId, message} from "./utils"
import {getServiceItem, MessageType, Method} from "./rpc"
import {LocalTopicImpl} from "./local"
import {createRemote, RemoteTopicImpl} from "./remote"

let callTimeout: number = 3 * 60 * 1000 // 3 mins

export function setCallTimeout(v) {
  callTimeout = v
}

export interface RpcSessionListeners {
  messageIn(data: string): void
  messageOut(data: string): void
  subscribed(subscriptions: number): void
  unsubscribed(subscriptions: number): void
}

export class RpcSession {
  constructor(
    private local: any,
    remoteLevel: number,
    private listeners: RpcSessionListeners,
    private connectionContext: any,
    private localMiddleware: (ctx, next) => Promise<any>,
    private messageParser: (data) => any[],
    private keepAlivePeriod: number,
    private syncRemoteCalls: boolean
  ) {
    this.remote = createRemote(remoteLevel, this)
  }

  public remote: any

  open(ws) {
    this.ws = ws
    resubscribeTopics(this.remote)

    if (this.keepAlivePeriod) {
      this.pingTimer = setTimeout(this.sendPing, this.keepAlivePeriod)

      ws.on("pong", () => {
        // log.debug(`CP ${this.chargeBoxId} received pong`)

        if (this.runningCalls[PING_MESSAGE_ID]) {
          this.runningCalls[PING_MESSAGE_ID].resolve()
          delete this.runningCalls[PING_MESSAGE_ID]
        }
      })

      ws.on("close", () => {
        clearTimeout(this.pingTimer)
      })
    }

    this.callTimeoutTimer = setInterval(() => this.timeoutCalls(), 1000) // every 1s
  }

  async close() {
    // stop timer
    clearInterval(this.callTimeoutTimer)

    // clear subscriptions
    await Promise.all(this.subscriptions.map(s => s.topic.unsubscribeSession(this, s.params)))
    this.subscriptions = []

    this.listeners.unsubscribed(0)

    // timeout pending calls
    ;[...this.queue, ...Object.values(this.runningCalls)].forEach(call => {
      call.reject("Timeout")
    })

    this.queue = []
    this.runningCalls = {}
  }

  private callTimeoutTimer

  sendPing = async () => {
    try {
      // call will be rejected if no reply will come in keepAlivePeriod / 2, see #sendCall
      await this.callRemote("", "ping", "ping")
      this.pingTimer = setTimeout(this.sendPing, this.keepAlivePeriod)
    } catch (e) {
      log.warn(`Keep alive check failed`)
      this.terminate()
    }
  }

  private pingTimer

  terminate() {
    this.ws.terminate()
  }

  handleMessage(data) {
    try {
      this.listeners.messageIn(data)

      const message = this.messageParser(data)

      if (message[0] == MessageType.Result || message[0] == MessageType.Error) {
        return this.callRemoteResponse(message)
      }

      const [type, id, name, ...other] = message

      const item = getServiceItem(this.local, name)

      const localTopic = (item as any) as LocalTopicImpl<any, any>
      const method = item as Method

      switch (type) {
        case MessageType.Subscribe:
          if (!localTopic) {
            throw new Error(`Can't find local topic with name ${name}`)
          }

          this.subscribe(localTopic, other[0])
          break

        case MessageType.Unsubscribe:
          if (!localTopic) {
            throw new Error(`Can't find local topic with name ${name}`)
          }

          this.unsubscribe(localTopic, other[0])
          break

        case MessageType.Get:
          if (!localTopic) {
            this.send(MessageType.Error, id, `Topic ${name} not implemented`, {})
            break
          }

          this.get(id, localTopic, other[0])
          break

        case MessageType.Call:
          if (!method) {
            this.send(MessageType.Error, id, `Item ${name} not implemented`, {})
            break
          }

          this.callLocal(id, method, other[0])
          break

        case MessageType.Data:
          const remoteTopic = (getServiceItem(this.remote, name) as any) as RemoteTopicImpl<
            any,
            any
          >

          if (!remoteTopic) {
            throw new Error(`Can't find remote topic with name ${name}`)
          }

          remoteTopic.receiveData(other[0], other[1])
          break
      }
    } catch (e) {
      log.error(`Failed to handle RPC message ${data}\n`, e)
    }
  }

  send(type: MessageType, id: string, ...params) {
    const data = message(type, id, ...params)
    this.listeners.messageOut(data)
    this.ws.send(data)
  }

  private timeoutCalls() {
    const now = Date.now()

    for (const messageId of Object.keys(this.runningCalls)) {
      const expireCallBefore =
        messageId == PING_MESSAGE_ID ? now - this.keepAlivePeriod / 2 : now - callTimeout

      if (this.runningCalls[messageId].startedAt < expireCallBefore) {
        const {reject} = this.runningCalls[messageId]
        delete this.runningCalls[messageId]
        reject(new Error("Timeout"))
      }
    }
  }

  callRemote(name, params, type) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        type,
        name: name,
        params: params,
        resolve,
        reject,
      })

      this.sendCall()
    })
  }

  private sendCall() {
    if (!!Object.keys(this.runningCalls).length && this.syncRemoteCalls) {
      return
    }

    while (this.queue.length > 0) {
      const call = this.queue.shift()
      call.startedAt = Date.now()

      if (call.type == "ping") {
        this.runningCalls[PING_MESSAGE_ID] = call
        this.ws.ping(call.params)
        // log.debug(`CP ${this.chargeBoxId} sent ping`)
      } else {
        const messageId = createMessageId()
        this.runningCalls[messageId] = call
        this.send(call.type, "" + messageId, call.name, call.params)
      }

      if (this.syncRemoteCalls) return
    }
  }

  /** Creates call context - context to be used in calls */
  public createContext() {
    return {
      ...this.connectionContext,
      remote: this.remote,
    }
  }

  private callRemoteResponse(data) {
    const [_, id, res] = data

    if (this.runningCalls[id]) {
      const {resolve, reject} = this.runningCalls[id]
      delete this.runningCalls[id]

      if (data[0] == MessageType.Result) {
        resolve(res)
      } else {
        reject(res)
      }
    }

    this.sendCall()
  }

  private async callLocal(id, remoteMethod, params) {
    try {
      const callContext = this.createContext()
      const r = await this.localMiddleware(callContext, () => remoteMethod(params, callContext))

      this.send(MessageType.Result, id, r)
    } catch (e) {
      log.error("Unable to call method ", e)

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
    this.listeners.subscribed(this.subscriptions.length)
  }

  private async unsubscribe(topic: LocalTopicImpl<any, any>, params) {
    await topic.unsubscribeSession(this, params)

    const paramsKey = JSON.stringify(params)

    this.subscriptions = this.subscriptions.filter(
      s => s.topic != topic || JSON.stringify(s.params) != paramsKey
    )
    this.listeners.unsubscribed(this.subscriptions.length)
  }

  private ws = null

  public subscriptions: {topic; params}[] = []

  private queue: Call[] = []
  private runningCalls: {[messageId: string]: Call} = {}
}

function resubscribeTopics(remote) {
  Object.getOwnPropertyNames(remote).forEach(key => {
    if (typeof remote[key] == "object") {
      resubscribeTopics(remote[key])
    } else {
      remote[key].resubscribe()
    }
  })
}

interface Call {
  type: MessageType.Call | MessageType.Get | "ping"
  name: string
  params: object

  resolve(r?): void
  reject(r?): void

  startedAt?: number
}

const PING_MESSAGE_ID = "–ws-ping"
