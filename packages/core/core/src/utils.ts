import * as UUID from "uuid-js"
import {MessageType} from "./rpc"

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

function convertDateToString<T>(message: T, format): T {
  if (!message) return message

  Object.keys(message).forEach(key => {
    const prop = message[key]

    if (typeof prop != "object") return

    if (prop instanceof Date) {
      message[key] = format(prop)
      return
    }

    if (!Array.isArray(prop)) return convertDateToString(prop, format)

    for (let i = 0; i < prop.length; i++) {
      convertDateToString(prop[i], format)
    }
  })

  return message
}

export const ISO8601 =      /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/
export const ISO8601_secs = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
export const ISO8601_date = /^\d\d\d\d-\d\d-\d\d$/

export function createMessageId() {
  return UUID.create().toString()
}

export function message(type: MessageType, id: string, ...params) {
  websocketDateToString(params)

  return JSON.stringify([type, id, ...params])
}

export function getClassMethodNames(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
    .filter(m => obj[m] instanceof Function)
    .filter(m => obj[m].name != "constructor")

}