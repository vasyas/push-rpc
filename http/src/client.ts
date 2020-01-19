import {Socket} from "@push-rpc/core"
import {MessageType} from "../../core/src/rpc"

export function createHttpClient(urlPrefix: string): Socket {
  let handleMessage = (message: string) => {}
  let handleError = (e: any) => {}

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
          body: JSON.stringify(params),
        })

        if (response.status < 200 && response.status >= 300) {
          // TODO parse error json
          throw new Error(response.statusText)
        }

        const json = await response.json()

        if (type == MessageType.Call || type == MessageType.Get) {
          handleMessage(JSON.stringify([MessageType.Result, id, json]))
        }

        if (type == MessageType.Subscribe) {
          handleMessage(JSON.stringify([MessageType.Data, id, name, params, json]))
        }
      } catch (e) {
        if (type == MessageType.Call || type == MessageType.Get)
          handleMessage(JSON.stringify([MessageType.Error, id, "code", "", {message: e.message}]))
      }
    }
  }

  return {
    onMessage(h) {
      handleMessage = h
    },
    onOpen(h) {
      // HTTP is connection less and always open
      setTimeout(h, 0)
    },
    onClose(h) {
      // HTTP is connection less
    },
    onError(h) {
      handleError = h
    },
    onPong() {},

    terminate() {},
    send(data) {
      sendHttpRequest(data)
    },
    ping() {},
  }
}
