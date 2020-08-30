import {log} from "./logger"
import {createMessageId, message} from "./utils"
import {
  getServiceItem,
  MessageType,
  Method,
  Middleware,
  RpcConnectionContext,
  RpcContext,
} from "./rpc"
import {LocalTopicImpl} from "./local"
import {createRemote, RemoteTopicImpl} from "./remote"
import {Socket} from "./transport"

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
    private connectionContext: RpcConnectionContext,
    private localMiddleware: Middleware,
    private remoteMiddleware: Middleware,
    private messageParser: (data) => any[],
    private pingSendTimeout: number,
    private keepAliveTimeout: number,
    private callTimeout: number,
    private syncRemoteCalls: boolean
  ) {
    this.remote = createRemote(remoteLevel, this)
  }

  public remote: any
  public subscriptions: {topic; params}[] = []
  public lastMessageAt: number

  private callTimeoutTimer
  private pingTimer
  private keepAliveTimer

  private socket: Socket = null

  private queue: Call[] = []
  private runningCalls: {[messageId: string]: Call} = {}

  open(socket: Socket) {
    this.socket = socket
    this.lastMessageAt = Date.now()

    resubscribeTopics(this.remote)

    socket.onMessage(message => {
      this.handleMessage(message)
    })

    socket.onPing(() => {
      this.trackMessageReceived("PING")
    })

    socket.onPong(() => {
      this.trackMessageReceived("PONG")

      if (this.runningCalls[PING_MESSAGE_ID]) {
        this.runningCalls[PING_MESSAGE_ID].resolve()
        delete this.runningCalls[PING_MESSAGE_ID]
      }

      this.sendCall()
    })

    if (this.pingSendTimeout) {
      this.pingTimer = setTimeout(this.sendPing, this.pingSendTimeout)
    }

    if (this.keepAliveTimeout) {
      this.keepAliveTimer = setInterval(() => this.checkKeepAlive(), 1000)
    }

    this.callTimeoutTimer = setInterval(() => this.timeoutCalls(), 1000) // every 1s
  }

  private trackMessageReceived(msg) {
    this.lastMessageAt = Date.now()
    this.listeners.messageIn(msg)
  }

  async handleDisconnected() {
    // stop timers
    clearTimeout(this.pingTimer)
    clearInterval(this.keepAliveTimer)
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

  sendPing = async () => {
    try {
      await this.callRemote("", "ping", "ping")
      this.pingTimer = setTimeout(this.sendPing, this.pingSendTimeout)
    } catch (e) {
      log.debug(`Ping send failed ${this.connectionContext.remoteId}`)
    }
  }

  private checkKeepAlive() {
    const now = Date.now()

    if (this.lastMessageAt < now - this.keepAliveTimeout) {
      log.debug(`Keep alive period expired, closing socket ${this.connectionContext.remoteId}`)
      this.disconnect()
    }
  }

  disconnect() {
    this.socket.disconnect()
  }

  handleMessage(data) {
    try {
      this.trackMessageReceived(data)

      // handle emulated PINGs
      if (data == PING_MESSAGE) {
        this.listeners.messageOut(PONG_MESSAGE)
        this.socket.send(PONG_MESSAGE)
        return
      }

      const message = this.messageParser(data)

      if (message[0] == MessageType.Result || message[0] == MessageType.Error) {
        return this.callRemoteResponse(message)
      }

      const [type, id, name, ...other] = message

      const {item, object} = getServiceItem(this.local, name)

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
            this.send(MessageType.Error, id, null, `Topic ${name} not implemented`, {})
            break
          }

          this.get(id, localTopic, other[0])
          break

        case MessageType.Call:
          if (!method) {
            this.send(MessageType.Error, id, null, `Item ${name} not implemented`, {})
            break
          }

          this.invokeLocal(id, name, method, object, other[0])
          break

        case MessageType.Data:
          const remoteTopic = (getServiceItem(this.remote, name).item as any) as RemoteTopicImpl<
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
      log.error(
        `Failed to handle RPC message ${data}\n, remote id ${this.connectionContext.remoteId}`,
        e
      )
    }
  }

  sendError(id, error: Error) {
    const err = Object.getOwnPropertyNames(error)
      .filter(prop => prop != "stack" && prop != "message" && prop != "code")
      .reduce((r, key) => ({...r, [key]: error[key]}), {})

    this.send(MessageType.Error, id, error["code"], error.message, err)
  }

  send(type: MessageType, id: string, ...params) {
    const data = message(type, id, ...params)
    this.listeners.messageOut(data)
    this.socket.send(data)
  }

  private timeoutCalls() {
    const now = Date.now()

    for (const messageId of Object.keys(this.runningCalls)) {
      const expireCallBefore = now - this.callTimeout

      if (this.runningCalls[messageId].startedAt < expireCallBefore) {
        const {reject} = this.runningCalls[messageId]
        delete this.runningCalls[messageId]
        reject(new Error("Timeout"))
      }
    }
  }

  callRemote(name, params, type) {
    const sendMessage = p => {
      return new Promise((resolve, reject) => {
        this.queue.push({
          type,
          name: name,
          params: p,
          resolve,
          reject,
        })

        this.sendCall()
      })
    }

    return this.remoteMiddleware(null, sendMessage, params)
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
        this.socket.ping(JSON.stringify(call.params))
        this.listeners.messageOut("PING")
      } else {
        const messageId = createMessageId()
        this.runningCalls[messageId] = call
        this.send(call.type, "" + messageId, call.name, call.params)
      }

      if (this.syncRemoteCalls) return
    }
  }

  /** Creates call context - context to be used in calls */
  public createContext(messageId?, itemName?, item?): RpcContext {
    return {
      ...this.connectionContext,
      remote: this.remote,
      item,
      messageId,
      itemName,
    }
  }

  private callRemoteResponse(data) {
    const [_, id, res, description, details] = data

    if (this.runningCalls[id]) {
      const {resolve, reject} = this.runningCalls[id]
      delete this.runningCalls[id]

      if (data[0] == MessageType.Result) {
        resolve(res)
      } else {
        const error = new Error(description || res || "Remote call failed")
        Object.assign(error, details || {})
        if (res != null) error["code"] = res
        reject(error)
      }
    }

    this.sendCall()
  }

  private async invokeLocal(id, name, localMethod, localMethodObject, params) {
    try {
      const callContext = this.createContext(id, name, localMethod)

      const invokeLocalMethod = (p = params) => localMethod.call(localMethodObject, p, callContext)
      const r = await this.localMiddleware(callContext, invokeLocalMethod, params)

      this.send(MessageType.Result, id, r)
    } catch (e) {
      log.error(`Unable to call method ${name} with params ${JSON.stringify(params)}. `, e)
      this.sendError(id, e)
    }
  }

  private async get(id, topic: LocalTopicImpl<any, any>, params) {
    try {
      const d = await topic.getData(params, this.createContext(id, topic.name))
      this.send(MessageType.Result, id, d)
    } catch (e) {
      this.sendError(id, e)
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

export const PING_MESSAGE = "PING"
export const PONG_MESSAGE = "PONG"