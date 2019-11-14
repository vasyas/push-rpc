import * as WebSocket from "ws"
import {Services} from "./shared"
import {createRpcClient, setLogger} from "../../src"

setLogger(console);

(async () => {
  const services: Services = await createRpcClient({
    level: 1,
    createWebSocket: () => new WebSocket("ws://localhost:5555")
  })

  console.log("Client connected")

  services.todo.todos.subscribe((todos) => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()