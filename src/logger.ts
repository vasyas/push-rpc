export interface Logger {
  info(s: unknown, ...params: unknown[]): void
  error(s: unknown, ...params: unknown[]): void
  warn(s: unknown, ...params: unknown[]): void
  debug(s: unknown, ...params: unknown[]): void
}

export let log: Logger = console

export function setLogger(l: Logger) {
  log = l
}
