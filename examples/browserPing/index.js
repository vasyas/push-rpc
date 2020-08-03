const {createRpcClient, PING_MESSAGE, PONG_MESSAGE} = require("@push-rpc/core")

async function start() {
  const {remote} = await createRpcClient(1, () => createWebsocket("ws://192.168.0.35:5555"), {
    // without pings client won't be able to detect connection loss
    pingSendTimeout: 10 * 1000,
    keepAliveTimeout: 20 * 1000,
    listeners: {
      unsubscribed() {},
      subscribed(){},
      disconnected() {
        console.log("Disconnected")
        document.getElementById("status").innerHTML = "Disconnected"
      },
      connected() {
        console.log("Connected")
        document.getElementById("status").innerHTML = "Connected"
      },
      messageIn(data) {
        console.log("IN", data)
      },
      messageOut(data) {
        console.log("OUT", data)
      },
    },
    reconnect: true,
  })

  remote.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })
}

function createWebsocket(url, protocols = undefined) {
  const ws = new WebSocket(url, protocols)

  let onPong = () => {}
  let onClose = () => {}

  return {
    onMessage: h => {
      ws.onmessage = e => {
        const message = e.data.toString()

        if (message == PONG_MESSAGE)
          onPong()
        else
          h(message)
      }
    },
    onOpen: h => (ws.onopen = h),
    onClose: h => {
      onClose = h

      ws.onclose = ({ code, reason }) => {
        h(code, reason)
      }
    },
    onError: h => (ws.onerror = h),
    onPong: h => {
      onPong = h
    },
    onPing: h => {
      // not implemented
    },

    terminate: () => {
      try {
        ws.close()

        // we sent close frame, no need to wait for actual close
        onClose()
      } catch (e) {
        console.warn("Failed to close socket", e)
      }
    },
    send: data => ws.send(data),
    ping: () => {
      ws.send(PING_MESSAGE)
    },
  }
}

start()
