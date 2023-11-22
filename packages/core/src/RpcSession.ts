import {LocalTopicImpl} from "./local"
import {log} from "./logger"
import {createRemote, RemoteTopicImpl} from "./remote"
import {
  CallOptions,
  getServiceItem,
  MessageType,
  Method,
  Middleware,
  RpcConnectionContext,
  RpcContext,
} from "./rpc"
import {Socket} from "./transport"
import {createMessageId, message} from "./utils"
import jsonCircularStringify from "json-stringify-safe"

export interface RpcSessionListeners {
  messageIn(data: string): void
  messageOut(data: string): void
  subscribed(subscriptions: number): void
  unsubscribed(subscriptions: number): void
}

export class RpcSession {
  constructor(
    private local: any,
    private listeners: RpcSessionListeners,
    private connectionContext: RpcConnectionContext,
    private localMiddleware: Middleware,
    private remoteMiddleware: Middleware,
    private messageParser: (data) => any[],
    private pingSendTimeout: number,
    private keepAliveTimeout: number,
    private callTimeout: number,
    private syncRemoteCalls: boolean,
    private delayCalls: number
  ) {
    this.remote = createRemote(this)
  }

  public remote: any
  public subscriptions: {topic: LocalTopicImpl<unknown, unknown>; params: unknown}[] = []
  public lastMessageAt: number

  private callTimeoutTimer
  private pingTimer
  private keepAliveTimer

  private socket: Socket = null

  private queue: Call[] = []
  private runningCalls: {[messageId: string]: Call} = {}

  private lastSendAt: number = 0

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

      this.flushPendingCalls()
    })

    if (this.pingSendTimeout) {
      this.pingTimer = setTimeout(this.sendPing, this.pingSendTimeout)
    }

    if (this.keepAliveTimeout) {
      this.keepAliveTimer = setInterval(() => this.checkKeepAlive(), 1000)
    }

    this.callTimeoutTimer = setInterval(() => this.timeoutCalls(), 1000) // every 1s

    this.flushPendingCalls()
  }

  private trackMessageReceived(msg) {
    this.lastMessageAt = Date.now()
    this.listeners.messageIn(msg)
  }

  private resolveDisconnect = () => {}

  disconnect() {
    return new Promise<void>(resolve => {
      if (!this.socket) {
        resolve()
        return
      }

      const timer = setTimeout(() => {
        // if not disconnected in 5s, just ignore it
        log.debug(`Wait for disconnect timed out for ${this.connectionContext.remoteId}`)
        resolve()
      }, 5 * 1000)

      this.resolveDisconnect = () => {
        clearTimeout(timer)
        setTimeout(resolve, 0)
      }

      this.socket.disconnect()
    })
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
      call.reject(new Error("Timeout " + call.type + ", " + call.name))
    })

    this.queue = []
    this.runningCalls = {}

    this.resolveDisconnect()
    this.resolveDisconnect = () => {}

    this.socket = null
  }

  sendPing = async () => {
    try {
      await this.callRemote("", "ping", "ping", null)
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

  handleMessage(data) {
    try {
      this.trackMessageReceived(data)

      // handle emulated PINGs
      if (data == PING_MESSAGE) {
        if (this.socket) {
          this.listeners.messageOut(PONG_MESSAGE)
          this.socket.send(PONG_MESSAGE)
        } else {
          log.debug(`Received PING but socket is not open ${this.connectionContext.remoteId}`)
        }

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
            this.send(MessageType.Error, id, null, `Topic '${name}' not implemented`, null)
            break
          }

          this.subscribe(localTopic, other[0], id)
          break

        case MessageType.Unsubscribe:
          if (!localTopic) {
            this.send(MessageType.Error, id, null, `Topic '${name}' not implemented`, null)
            break
          }

          this.unsubscribe(localTopic, other[0])
          break

        case MessageType.Get:
          if (!localTopic) {
            this.send(MessageType.Error, id, null, `Topic '${name}' not implemented`, null)
            break
          }

          this.get(id, name, localTopic, other[0])
          break

        case MessageType.Call:
          if (!method) {
            this.send(MessageType.Error, id, null, `Item '${name}' not implemented`, null)
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
            log.debug(`Can't find remote topic with name '${name}'`)
            break
          }

          // release await on subscribe
          if (this.runningCalls[id]) {
            this.callRemoteResponse(message)
          }

          // and deliver to callback
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
    if (this.socket) {
      this.lastSendAt = Date.now()

      const data = message(type, id, ...params)
      this.listeners.messageOut(data)
      this.socket.send(data)
    } else {
      log.debug(`Can't send message, socket is not connected`)
    }
  }

  private timeoutCalls() {
    const now = Date.now()

    for (const messageId of Object.keys(this.runningCalls)) {
      const expireCallBefore = now - this.runningCalls[messageId].timeout

      if (this.runningCalls[messageId].startedAt < expireCallBefore) {
        const {reject} = this.runningCalls[messageId]
        delete this.runningCalls[messageId]
        reject(new Error("Timeout"))
      }
    }
  }

  callRemote(name, params, type, callOpts: CallOptions) {
    const sendMessage = p => {
      return new Promise((resolve, reject) => {
        this.queue.push({
          type,
          name,
          params: cloneParams(p),
          resolve,
          reject,
          timeout: callOpts?.timeout || this.callTimeout,
        })

        this.flushPendingCalls()
      })
    }

    return this.remoteMiddleware(null, sendMessage, params, type)
  }

  private flushPendingCalls() {
    if (this.delayCalls) {
      const delay = this.lastSendAt + this.delayCalls - Date.now()

      if (delay > 0) {
        setTimeout(() => this.flushPendingCalls(), delay)
        return
      }
    }

    if (!!Object.keys(this.runningCalls).length && this.syncRemoteCalls) {
      return
    }

    if (!this.socket) return

    while (this.queue.length > 0) {
      const call = this.queue.shift()
      call.startedAt = Date.now()

      if (call.type == "ping") {
        this.lastSendAt = Date.now()

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

  public getConnectionContext(): RpcConnectionContext {
    return this.connectionContext
  }

  private callRemoteResponse(data) {
    const [messageType, id, ...other] = data

    if (this.runningCalls[id]) {
      const {resolve, reject} = this.runningCalls[id]
      delete this.runningCalls[id]

      if (messageType == MessageType.Result || messageType == MessageType.Data) {
        if (messageType == MessageType.Result) {
          resolve(other[0])
        } else {
          resolve(other[2])
        }
      } else {
        const [res, description, details] = other

        const error = new Error(description || res || "Remote call failed")
        Object.assign(error, details || {})
        if (res != null) error["code"] = res
        reject(error)
      }
    }

    this.flushPendingCalls()
  }

  private async invokeLocal(id, name, localMethod, localMethodObject, params) {
    try {
      const callContext = this.createContext(id, name, localMethod)

      const invokeLocalMethod = (p = params) => localMethod.call(localMethodObject, p, callContext)
      const r = await this.localMiddleware(callContext, invokeLocalMethod, params, MessageType.Call)

      this.send(MessageType.Result, id, r)
    } catch (e) {
      log.error(`Unable to call method ${name} with params ${jsonCircularStringify(params)}. `, e)
      this.sendError(id, e)
    }
  }

  private async get(id, name: string, topic: LocalTopicImpl<any, any>, params) {
    try {
      const callContext = this.createContext(id, topic.getTopicName())

      const getFromTopic = (p = params) =>
        topic.getData(p, callContext, this.getConnectionContext())
      const r = await this.localMiddleware(callContext, getFromTopic, params, MessageType.Get)

      this.send(MessageType.Result, id, r)
    } catch (e) {
      log.error(`Unable to get data from topic ${name}`, e)
      this.sendError(id, e)
    }
  }

  private async subscribe(topic: LocalTopicImpl<any, any>, params, messageId) {
    try {
      const ctx = this.createContext(messageId, topic.getTopicName())

      const subscribeTopic = (p = params) => topic.subscribeSession(this, p, messageId, ctx)
      const r = await this.localMiddleware(ctx, subscribeTopic, params, MessageType.Subscribe)

      this.send(MessageType.Data, messageId, topic.getTopicName(), cloneParams(params), r)

      this.subscriptions.push({topic, params})
      this.listeners.subscribed(this.subscriptions.length)
    } catch (e) {
      log.error(`Unable to subscribe to topic ${topic.getTopicName()}`, e)
      this.sendError(messageId, e)
    }
  }

  private async unsubscribe(topic: LocalTopicImpl<any, any>, params) {
    await topic.unsubscribeSession(this, params)

    const paramsKey = JSON.stringify(params)

    const idx = this.subscriptions.findIndex(
      s => s.topic == topic || JSON.stringify(s.params) == paramsKey
    )

    if (idx >= 0) {
      this.subscriptions.splice(idx, 1)
    }

    this.listeners.unsubscribed(this.subscriptions.length)
  }
}

function resubscribeTopics(remote) {
  Object.getOwnPropertyNames(remote).forEach(key => {
    if (skippedRemoteProps.includes(key)) return

    // because each item is always a topic; but those that not subscribed will not do a thing on resubscribe
    remote[key].resubscribe()

    resubscribeTopics(remote[key])
  })
}

interface Call {
  type: MessageType.Call | MessageType.Get | "ping"
  name: string
  params: object
  timeout: number

  resolve(r?): void
  reject(r?): void

  startedAt?: number
}

const PING_MESSAGE_ID = "–ws-ping"

export const PING_MESSAGE = "PING"
export const PONG_MESSAGE = "PONG"

function cloneParams(p) {
  if (!p) return p
  if (typeof p == "object") {
    if (p instanceof Date) return p
    return JSON.parse(jsonCircularStringify(p))
  }
  return p
}

export const skippedRemoteProps = ["length", "name", "prototype", "arguments", "caller"]
