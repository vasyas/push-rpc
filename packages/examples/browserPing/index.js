const {createRpcClient, createDomWebsocket} = require("@push-rpc/core")

async function start() {
  const {remote} = await createRpcClient(async () => createDomWebsocket("ws://192.168.0.35:5555"), {
    // without pings client won't be able to detect connection loss
    pingSendTimeout: 10 * 1000,
    keepAliveTimeout: 20 * 1000,
    listeners: {
      unsubscribed() {},
      subscribed() {},
      disconnected() {
        console.log("Disconnected")
        document.getElementById("status").innerHTML = "Disconnected"
      },
      connected() {
        console.log("Connected")
        document.getElementById("status").innerHTML = "Connected"
      },
      messageIn(data) {
        console.log(`${Date.now()}. IN`, data)
      },
      messageOut(data) {
        console.log(`${Date.now()}. OUT`, data)
      },
    },
    reconnect: true,
  })

  remote.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })
}

start()
