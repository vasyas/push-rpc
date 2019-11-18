export interface Logger {
  info(s, ...params)
  error(s, ...params)
  warn(s, ...params)
  debug(s, ...params)
}

export let log: Logger = console

export function setLogger(l: Logger) {
  log = l
}
