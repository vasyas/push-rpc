import {createRpcClient, setLogger} from "@push-rpc/core"
import {createWebsocket} from "@push-rpc/websocket/dist/server"
import {Services} from "./shared"

setLogger(console)
;(async () => {
  const services: Services = (
    await createRpcClient(1, () => createWebsocket("ws://localhost:5555"), {
      pingSendTimeout: 20 * 1000,
      pongWaitTimeout: 20 * 1000,
      listeners: {
        unsubscribed(subscriptions: number): void {},
        subscribed(subscriptions: number): void {},
        disconnected({code, reason}: {code: any; reason: any}): void {},
        connected(): void {},
        messageIn(data: string): void {
          console.log("IN ", data)
        },
        messageOut(data: string): void {
          console.log("OUT ", data)
        },
      },
    })
  ).remote

  console.log("Client connected")

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()
