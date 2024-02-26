/** Limited Cookie support */
export class CookieJar {
  updateCookies(response: Response) {}

  getCookieString(): string {
    return ""
  }
}

export function parseClientCookies(str: string): Record<string, string> {
  const rx = /([^;=\s]*)=([^;]*)/g
  const r: Record<string, string> = {}

  for (let m; (m = rx.exec(str)); ) {
    r[m[1]] = decodeURIComponent(m[2])
  }
  return r
}
