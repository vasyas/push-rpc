import {Socket} from "../../core/src"
import {MessageType} from "../../core/src/rpc"

export function createHttpClient(urlPrefix: string): Socket {
  let handleMessage = (message: string) => {}
  let handleError = (e: any) => {}
  let handleClose = (code, reason) => {}

  async function sendHttpRequest(data) {
    const message = JSON.parse(data)
    const [type, id, name, params] = message

    if (type == MessageType.Get || type == MessageType.Call || type == MessageType.Subscribe) {
      const url = `${urlPrefix}${urlPrefix.endsWith("/") ? "" : "/"}${name}`

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: params == null ? null : JSON.stringify(params),
        })

        if (response.status < 200 && response.status >= 300) {
          if (type == MessageType.Call || type == MessageType.Get) {
            // TODO parse response body
            handleMessage(JSON.stringify([MessageType.Error, id, response.statusText, "", {}]))
          } else {
            // just log it?
          }
        }

        const json = await response.json()

        if (type == MessageType.Call || type == MessageType.Get) {
          handleMessage(JSON.stringify([MessageType.Result, id, json]))
        }

        if (type == MessageType.Subscribe) {
          handleMessage(JSON.stringify([MessageType.Data, id, name, params, json]))
        }
      } catch (e) {
        if (type == MessageType.Call || type == MessageType.Get) {
          handleMessage(JSON.stringify([MessageType.Error, id, e.message, "", {}]))
        }

        handleError(e)
      }
    }
  }

  return {
    onMessage(h) {
      handleMessage = h
    },
    onOpen(h) {
      setTimeout(h, 0)
    },
    onClose(h) {
      handleClose = h
    },
    onError(h) {
      handleError = h
    },
    onPong() {},

    terminate() {
      setTimeout(() => handleClose("forced", null), 0)
    },
    send(data) {
      sendHttpRequest(data)
    },
    ping() {},
  }
}
