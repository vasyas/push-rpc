import {connect, NatsConnection} from "nats"
import {createRpcClient} from "../../../core/src/client"
import {NatsTransport} from "../nats"
import {Services} from "./shared"

async function start() {
  const connection: NatsConnection = await connect()
  const transport = new NatsTransport("demo", connection)

  const services: Services = await createRpcClient(1, transport)

  console.log("Client connected")

  await services.todo.todos.subscribe(
    todo => {
      console.log("Got todo item", todo)
    },
    {id: 1}
  )

  await services.todo.update({id: 2, text: "updated"})
}

start()
