/** Limited Cookie support for non-browser clients */
export class ClientCookies {
  private cookies: Record<string, string> = {}

  updateCookies(setCookies: string[]) {
    setCookies.forEach((c) => {
      const [name, value] = c.split(";")[0].split("=")
      this.cookies[name] = value
    })
  }

  getCookieString(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")
  }
}

export function parseCookies(str: string): Record<string, string> {
  const rx = /([^;=\s]*)=([^;]*)/g
  const r: Record<string, string> = {}

  for (let m; (m = rx.exec(str)); ) {
    r[m[1]] = decodeURIComponent(m[2])
  }
  return r
}
