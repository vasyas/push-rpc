import {connect, NatsConnection} from "nats"
import {createRpcClient} from "../client"
import {NatsTransport} from "../nats"
import {Services} from "./shared"

async function start() {
  const connection: NatsConnection = await connect()
  const transport = new NatsTransport("demo", connection)

  const services: Services = await createRpcClient(1, transport)

  console.log("Client connected")

  await services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
}

start()
