import * as UUID from "uuid-js"
import jsonCircularStringify from "json-stringify-safe"
import {DataConsumer, MessageType, Middleware, RemoteTopic} from "./rpc"
import {PING_MESSAGE, PONG_MESSAGE} from "./RpcSession"
import {log} from "./logger"

export function dateReviver(key, val) {
  if (typeof val == "string") {
    if (ISO8601_secs.test(val)) {
      return new Date(val)
    }

    if (ISO8601.test(val)) {
      return new Date(val)
    }

    if (ISO8601_date.test(val)) {
      return new Date(val)
    }
  }

  return val
}

function websocketDateToString(message) {
  return convertDateToString(message, d => {
    const s = d.toISOString()

    return s.substring(0, s.lastIndexOf(".")) + "Z"
  })
}

function convertDateToString<T>(message: T, format, cache = []): T {
  if (!message) return message
  if (cache.indexOf(message) >= 0) return message

  cache.push(message)

  Object.keys(message).forEach(key => {
    const prop = message[key]

    if (typeof prop != "object") return

    if (prop instanceof Date) {
      message[key] = format(prop)
      return // continue?
    }

    // continue
    if (!Array.isArray(prop)) return convertDateToString(prop, format, cache)

    for (let i = 0; i < prop.length; i++) {
      convertDateToString(prop[i], format, cache)
    }
  })

  return message
}

export const ISO8601 = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/
export const ISO8601_secs = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
export const ISO8601_date = /^\d\d\d\d-\d\d-\d\d$/

export let createMessageId = () => UUID.create().toString()

export function setCreateMessageId(f: () => string) {
  createMessageId = f
}

export function message(type: MessageType, id: string, ...params) {
  websocketDateToString(params)

  return jsonCircularStringify([type, id, ...params])
}

export function getClassMethodNames(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
    .filter(m => obj[m] instanceof Function)
    .filter(m => obj[m].name != "constructor")
}

export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return function(ctx, next, params, messageType) {
    let index = -1
    return dispatch(0, params)

    function dispatch(i, p) {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"))

      index = i

      try {
        if (i === middleware.length) {
          return Promise.resolve(next(p))
        } else {
          return Promise.resolve(middleware[i](ctx, dispatch.bind(null, i + 1), p, messageType))
        }
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}

export function mapTopic<D1, P, D2>(t: RemoteTopic<D1, P>, map: (D1) => D2): RemoteTopic<D2, P> {
  return {
    subscribe(consumer: DataConsumer<D2>, params?: P, subscriptionKey?: any) {
      return t.subscribe(
        (d: D1) => {
          return consumer(map(d))
        },
        params,
        subscriptionKey
      )
    },
    unsubscribe(params?: P, subscriptionKey?: any) {
      return t.unsubscribe(params, subscriptionKey)
    },
    async get(params?: P): Promise<D2> {
      const d = await t.get(params)
      return map(d)
    },
  }
}

declare var WebSocket

// TODO better name would be createDomSocket
export function createDomWebsocket(url, protocols = undefined) {
  const ws = new WebSocket(url, protocols)

  let onPong = () => {}
  let onDisconnected = (code, reason) => {}

  function singleCallDisconnected(code, reason) {
    onDisconnected(code, reason)
    onDisconnected = () => {}
  }

  return {
    onMessage: h => {
      ws.onmessage = e => {
        const message = e.data.toString()

        if (message == PONG_MESSAGE) onPong()
        else h(message)
      }
    },
    onOpen: h => (ws.onopen = h),
    onDisconnected: h => {
      onDisconnected = h

      ws.onclose = ({code, reason}) => void singleCallDisconnected(code, reason)
    },
    onError: h => (ws.onerror = h),
    onPong: h => {
      onPong = h
    },
    onPing: h => {
      // not implemented
    },

    disconnect: () => {
      try {
        ws.close(3000, "forced")
      } catch (e) {
        console.warn("Failed to close socket", e)
      }

      // we sent close frame, no need to wait for actual close
      singleCallDisconnected(3000, "forced")
    },
    send: data => ws.send(data),
    ping: () => {
      ws.send(PING_MESSAGE)
    },
  }
}

export class PromiseCache<F, D> {
  invoke(cacheKey: unknown, supplier: () => Promise<D>): Promise<D> {
    const key = JSON.stringify(cacheKey)

    if (!this.cache[key]) {
      this.cache[key] = supplier()
        .then(r => {
          delete this.cache[key]
          return r
        })
        .catch(e => {
          delete this.cache[key]
          throw e
        })
    }

    return this.cache[key]
  }

  private cache: {[key: string]: Promise<D>} = {}
}

export function safeListener(f: () => void) {
  try {
    f()
  } catch (e) {
    log.error("Error in listener", e)
  }
}
