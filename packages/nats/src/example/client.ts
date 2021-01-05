import {connect, NatsConnection} from "nats"
import {Services} from "./shared"
import {createRpcClient} from "../nats"

async function start() {
  const connection: NatsConnection = await connect()

  const services: Services = await createRpcClient(1, connection)

  console.log("Client connected")

  console.log(await services.todo.getHello())

  // services.todo.todos.subscribe(() => {
  //
  // })
}

start()
