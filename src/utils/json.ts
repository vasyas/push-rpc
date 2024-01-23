import stringify from "fast-stringify"

export function safeStringify(value: any): string {
  // @ts-ignore
  return stringify(value)
}

export function safeParseJson(json: string): any {
  return JSON.parse(json, dateReviver)
}

function dateReviver(key: string, val: any) {
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

const ISO8601 = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/
const ISO8601_secs = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
const ISO8601_date = /^\d\d\d\d-\d\d-\d\d$/
