export interface Logger {
  info(s, ...params)
  error(s, ...params)
  warn(s, ...params)
  debug(s, ...params)
}

export let log: Logger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
}

export function setLogger(l: Logger) {
  log = l
}
