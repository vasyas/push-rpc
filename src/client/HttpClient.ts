import {CLIENT_ID_HEADER, RpcErrors} from "../rpc.js"
import {safeParseJson, safeStringify} from "../utils/json.js"
import {ClientCookies} from "../utils/cookies"

export class HttpClient {
  constructor(
    private url: string,
    private clientId: string,
    private getHeaders: () => Promise<Record<string, string>>,
    private cookies: ClientCookies
  ) {}

  async call(itemName: string, params: unknown[], callTimeout: number): Promise<unknown> {
    return this.httpRequest("POST", itemName, params, callTimeout, await this.getHeaders())
  }

  async subscribe(itemName: string, params: unknown[], callTimeout: number) {
    return this.httpRequest("PUT", itemName, params, callTimeout, await this.getHeaders())
  }

  async unsubscribe(itemName: string, params: unknown[], callTimeout: number) {
    await this.httpRequest("PATCH", itemName, params, callTimeout, await this.getHeaders())
  }

  private getItemUrl(itemName: string): string {
    return `${this.url}/${itemName}`
  }

  private async httpRequest(
    method: "POST" | "PUT" | "PATCH",
    itemName: string,
    params: unknown[],
    callTimeout: number,
    headers: Record<string, string>
  ): Promise<unknown> {
    const itemUrl = this.getItemUrl(itemName)

    try {
      const {signal, finished} = timeoutSignal(callTimeout)

      const cookie = this.cookies.getCookieString()
      if (cookie) {
        headers["Cookie"] = cookie
      }

      const response = await fetch(itemUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          [CLIENT_ID_HEADER]: this.clientId,
          ...headers,
        },
        body: safeStringify(params),
        signal,
      })

      finished()

      this.cookies.updateCookies(response.headers.getSetCookie())

      if (response.status == 204) {
        return
      }

      const contentType = response.headers.get("content-type")

      const text = await response.text()

      const res =
        contentType && contentType.includes("application/json") ? safeParseJson(text) : text

      if (response.status < 200 || response.status >= 300) {
        const error = new Error(response.statusText)

        Object.assign(error, {code: response.status})

        if (typeof res == "object") {
          Object.assign(error, res)
        }

        throw error
      } else {
        return res
      }
    } catch (e: any) {
      if (e.message == "Error" || !e.message) {
        e.message = `Error ${e.code} while ${itemUrl}`
      }

      if (e.message == "fetch failed" && e.cause) {
        e = e.cause
      }
      if (e.message?.toLowerCase()?.includes("timeout")) {
        // NodeJS undici http client timeout
        const error = new Error("Timeout")
        Object.assign(error, {code: RpcErrors.Timeout})
        throw error
      }
      throw e
    }
  }
}

// AbortSignal.timeout polyfill for RN
function timeoutSignal(time: number): {signal: AbortSignal; finished(): void} {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error("TimeoutError")), time)

  return {
    signal: controller.signal,
    finished: () => clearTimeout(timeout),
  }
}
