import {createRpcClient, setLogger} from "@push-rpc/core"
import {createNodeWebsocket} from "@push-rpc/websocket"
import {Services} from "./shared"

setLogger(console)
;(async () => {
  const services: Services = (
    await createRpcClient(async () => createNodeWebsocket("ws://localhost:5555"), {
      // without pings client won't be able to detect lost connection to server
      pingSendTimeout: 20 * 1000,
      keepAliveTimeout: 20 * 1000,
      listeners: {
        unsubscribed(subscriptions: number): void {},
        subscribed(subscriptions: number): void {},
        disconnected({code, reason}: {code: any; reason: any}): void {
          console.log("Disconnected")
        },
        connected(): void {
          console.log("Connected")
        },
        messageIn(data: string): void {
          console.log("IN ", data)
        },
        messageOut(data: string): void {
          console.log("OUT ", data)
        },
      },
      reconnect: true,
    })
  ).remote

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  // do not end process
  await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 100))
})()
