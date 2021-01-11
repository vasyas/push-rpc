import {LocalTopic} from "./topic"

export const ITEM_NAME_SEPARATOR = "/"

export type Method = (req?, ctx?) => Promise<any>
export type ServiceItem =
  | {method: Method; object: any}
  | {topic: LocalTopic<never, never>; object: any}

export function dateToIsoString(d: Date): string {
  const s = d.toISOString()

  return s.substring(0, s.lastIndexOf(".")) + "Z"
}

export function getClassMethodNames(obj) {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj))
    .filter(m => obj[m] instanceof Function)
    .filter(m => obj[m].name != "constructor")
}
