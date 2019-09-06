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

export const ISO8601 =      /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/
export const ecofactor =      /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\d\d\d\d$/
export const ISO8601_secs = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ$/
export const ISO8601_date = /^\d\d\d\d-\d\d-\d\d$/
