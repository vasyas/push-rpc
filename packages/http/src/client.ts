import {Socket} from "@push-rpc/core"
import {MessageType} from "@push-rpc/core"
import {log} from "@push-rpc/core/dist/logger"

export function createHttpClient(urlPrefix: string, headers = {}): Socket {
  let handleMessage = (message: string) => {}
  let handleError = (e: any) => {}
  let handleClose = (code, reason) => {}

  async function sendHttpRequest(data) {
    const message = JSON.parse(data)
    const [type, id, name, params] = message

    if (type == MessageType.Get || type == MessageType.Call || type == MessageType.Subscribe) {
      const url = `${urlPrefix}${urlPrefix.endsWith("/") ? "" : "/"}${name}`

      let method = "POST"
      if (type == MessageType.Get) method = "PUT"
      if (type == MessageType.Subscribe) method = "PATCH"

      try {
        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: params == null ? null : JSON.stringify(params),
        })

        let res = null

        if (response.status != 204) {
          const contentType = response.headers.get("content-type")

          if (contentType && contentType.includes("application/json")) {
            res = await response.json()
          } else {
            res = await response.text()
          }
        }

        if (response.status < 200 || response.status >= 300) {
          if (type == MessageType.Call || type == MessageType.Get) {
            handleMessage(
              JSON.stringify([MessageType.Error, id, response.status, response.statusText, res])
            )
          } else {
            log.error(`Unexpected response for message type ${type}`, response.status, res)
          }
        }

        if (type == MessageType.Call || type == MessageType.Get) {
          handleMessage(JSON.stringify([MessageType.Result, id, res]))
        }

        if (type == MessageType.Subscribe) {
          handleMessage(JSON.stringify([MessageType.Data, id, name, params, res]))
        }
      } catch (e) {
        if (type == MessageType.Call || type == MessageType.Get) {
          handleMessage(JSON.stringify([MessageType.Error, id, e.message, "", {}]))
        }

        handleError(e)
      }
    } else {
      throw new Error("Unsupported message type " + type)
    }
  }

  return {
    onMessage(h) {
      handleMessage = h
    },
    onOpen(h) {
      setTimeout(h, 0)
    },
    onDisconnected(h) {
      handleClose = h
    },
    onError(h) {
      handleError = h
    },
    onPong() {},
    onPing() {},

    disconnect() {
      setTimeout(() => handleClose("forced", null), 0)
    },
    send(data) {
      sendHttpRequest(data)
    },
    ping() {},
  }
}
