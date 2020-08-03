const {createRpcClient} = require("@push-rpc/core")

async function start() {
  const {remote} = await createRpcClient(1, () => createWebsocket("ws://localhost:5555"), {
    // pingSendTimeout: 20 * 1000,
    // keepAliveTimeout: 20 * 1000,
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
        console.log("IN ", data)
      },
      messageOut(data) {
        console.log("OUT ", data)
      },
    },
    reconnect: true,
  })

  remote.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })
}

function createWebsocket(url) {
  const ws = new WebSocket(url)

  return {
    onMessage: h =>
      (ws.onmessage = e => {
        h(e.data.toString())
      }),
    onOpen: h => (ws.onopen = h),
    onClose: h =>
      (ws.onclose = ({code, reason}) => {
        h(code, reason)
      }),
    onError: h => (ws.onerror = h),
    onPong: h => {
      // not implemented
    },
    onPing: h => {
      // not implemented
    },

    terminate: () => ws.close(),
    send: data => ws.send(data),
    ping: () => {
      // not implemented
    },
  }
}

start()
