import {createRpcClient, setLogger} from "@push-rpc/core"
import {createWebsocket} from "@push-rpc/websocket/dist/server"
import {Services} from "./shared"

setLogger(console)
;(async () => {
  const services: Services = (
    await createRpcClient(1, () => createWebsocket("ws://localhost:5555"), {
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
    })
  ).remote

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })
})()
