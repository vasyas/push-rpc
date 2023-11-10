import {createRpcClient, setLogger} from "@push-rpc/core"
import {createNodeWebsocket} from "@push-rpc/websocket"
import {Services} from "./shared"

setLogger(console)
;(async () => {
  const services: Services = (
    await createRpcClient(async () => createNodeWebsocket("ws://localhost:5555"))
  ).remote

  console.log("Client connected")

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()
