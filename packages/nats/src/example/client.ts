import {connect, NatsConnection} from "nats"
import {Services} from "./shared"
import {createRpcClient} from "../nats"

async function start() {
  const connection: NatsConnection = await connect()

  const services: Services = await createRpcClient(1, "demo", connection)

  console.log("Client connected")

  async function call(i) {
    console.log("Before request " + i)
    console.log(await services.todo.getHello(i))
    console.log("Got response " + i)
  }

  for (let i = 0; i < 10; i++) {
    call(i)
  }

  // services.todo.todos.subscribe(() => {
  //
  // })
}

start()
