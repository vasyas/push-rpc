import {connect, NatsConnection} from "nats"
import {Services} from "./shared"
import {createRpcClient} from "../client"

async function start() {
  const connection: NatsConnection = await connect()

  const services: Services = await createRpcClient(1, "demo", connection)

  console.log("Client connected")

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  // await services.todo.addTodo({text: "Buy groceries"})
}

start()
