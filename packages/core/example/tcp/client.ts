import {Services} from "../basic/shared"
import {createRpcClient, setLogger} from "../../src"

setLogger(console)
;(async () => {
  const services: Services = (await createRpcClient(1, () => new WebSocket("ws://localhost:5555")))
    .remote

  console.log("Client connected")

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()
