import {
  CLIENT_ID_HEADER,
  ERROR_HEADER,
  RpcError,
  RpcErrors,
  SubscriptionOwnership,
  SUBSCRIPTION_EPOCH_HEADER,
  SUBSCRIPTION_LIFETIME_HEADER,
  SUBSCRIPTION_VERSION_HEADER,
} from "../rpc.js"
import {withDeadline} from "../utils/promises.js"
import {safeParseJson, safeStringify} from "../utils/json.js"

export class UnsupportedSubscriptionProtocol extends Error {
  constructor() {
    super("Server does not support subscription lifetime protocol v1")
  }
}

export class HttpClient {
  constructor(
    private url: string,
    private clientId: string,
    private getHeaders: () => Promise<Record<string, string>>,
  ) {}

  async call(itemName: string, params: unknown[], callTimeout: number): Promise<unknown> {
    return this.httpRequest("POST", itemName, params, callTimeout, await this.getHeaders())
  }

  async subscribe(
    itemName: string,
    params: unknown[],
    callTimeout: number,
    ownership?: SubscriptionOwnership,
    deadline?: number,
    isCurrent?: () => boolean,
  ) {
    if (ownership)
      return this.ownedRequest("PUT", itemName, params, ownership, deadline!, isCurrent)
    return this.httpRequest("PUT", itemName, params, callTimeout, await this.getHeaders())
  }

  async unsubscribe(
    itemName: string,
    params: unknown[],
    callTimeout: number,
    ownership?: SubscriptionOwnership,
    deadline?: number,
  ) {
    if (ownership) return this.ownedRequest("PATCH", itemName, params, ownership, deadline!)
    await this.httpRequest("PATCH", itemName, params, callTimeout, await this.getHeaders())
  }

  private async ownedRequest(
    method: "PUT" | "PATCH",
    itemName: string,
    params: unknown[],
    ownership: SubscriptionOwnership,
    deadline: number,
    isCurrent?: () => boolean,
  ) {
    // Capture the wire key before getHeaders: application objects may change while it awaits.
    const body = safeStringify(params)
    const headers = await withDeadline(this.getHeaders(), deadline)
    if (isCurrent && !isCurrent()) return
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new RpcError(RpcErrors.Timeout, "Timeout")
    return this.httpRequest(method, itemName, params, remaining, headers, ownership, body)
  }

  private getItemUrl(itemName: string): string {
    return `${this.url}/${itemName}`
  }

  private async httpRequest(
    method: "POST" | "PUT" | "PATCH",
    itemName: string,
    params: unknown[],
    callTimeout: number,
    headers: Record<string, string>,
    ownership?: SubscriptionOwnership,
    body?: string,
  ): Promise<unknown> {
    const itemUrl = this.getItemUrl(itemName)

    const {signal, finished} = timeoutSignal(callTimeout)
    try {
      const response = await fetch(itemUrl, {
        method,
        headers: {
          "Content-Type": "application/json",
          [CLIENT_ID_HEADER]: this.clientId,
          ...headers,
          ...(ownership
            ? {
                [SUBSCRIPTION_EPOCH_HEADER]: ownership.epoch,
                [SUBSCRIPTION_LIFETIME_HEADER]: String(ownership.lifetime),
              }
            : {}),
        },
        body: body ?? safeStringify(params),
        signal,
      })

      const hasError = response.headers.has(ERROR_HEADER)
      // Proxies can return unversioned errors during outages; keep those recoverable.
      if (
        ownership &&
        !hasError &&
        response.status >= 200 &&
        response.status < 300 &&
        response.headers.get(SUBSCRIPTION_VERSION_HEADER) !== "1"
      ) {
        void response.body?.cancel().catch(() => {})
        throw new UnsupportedSubscriptionProtocol()
      }

      if (!hasError && response.status == 204) {
        return
      }

      const contentType = response.headers.get("content-type")

      const text = await response.text()

      const res =
        contentType && contentType.includes("application/json") ? safeParseJson(text) : text

      if (hasError || response.status < 200 || response.status >= 300) {
        const error = new Error(
          !!response.headers.get(ERROR_HEADER)
            ? decodeURIComponent(response.headers.get(ERROR_HEADER)!!)
            : undefined,
        )

        Object.assign(error, {code: response.status})

        if (typeof res == "object") {
          Object.assign(error, res)
        }

        throw error
      } else {
        return res
      }
    } catch (e: any) {
      e.remoteUrl = itemUrl

      if (e.message == "Error" || !e.message) {
        delete e.message
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
    } finally {
      // Receiving headers does not mean the snapshot is complete. A stalled body
      // must time out too, otherwise it can occupy a recovery slot indefinitely.
      finished()
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
