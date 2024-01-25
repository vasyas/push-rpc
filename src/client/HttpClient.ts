import {CLIENT_ID_HEADER, RpcErrors} from "../rpc.js"
import {safeParseJson, safeStringify} from "../utils/json.js"

export class HttpClient {
  constructor(
    private url: string,
    private clientId: string
  ) {}

  call(itemName: string, params: unknown[], callTimeout: number): Promise<unknown> {
    return this.httpRequest("POST", itemName, params, callTimeout)
  }

  async subscribe(itemName: string, params: unknown[], callTimeout: number) {
    return this.httpRequest("PUT", itemName, params, callTimeout)
  }

  async unsubscribe(itemName: string, params: unknown[], callTimeout: number) {
    await this.httpRequest("PATCH", itemName, params, callTimeout)
  }

  private getItemUrl(itemName: string): string {
    return `${this.url}/${itemName}`
  }

  private async httpRequest(
    method: "POST" | "PUT" | "PATCH",
    itemName: string,
    params: unknown[],
    callTimeout: number
  ): Promise<unknown> {
    try {
      const response = await fetch(this.getItemUrl(itemName), {
        method,
        headers: {
          "Content-Type": "application/json",
          [CLIENT_ID_HEADER]: this.clientId,
        },
        body: safeStringify(params),
        signal: AbortSignal.timeout(callTimeout),
      })

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
