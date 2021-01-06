import {connect, NatsConnection} from "nats"
import {createRpcServer} from "../nats"
import {Services, TodoService} from "./shared"

async function start() {
  class TodoServiceImpl implements TodoService {
    async getHello(i: number): Promise<string> {
      await new Promise(r => setTimeout(r, 100 * Math.random()))

      return "hello " + i
    }
  }

  const services: Services = {
    todo: new TodoServiceImpl(),
  }

  const connection: NatsConnection = await connect()

  await createRpcServer(services, "demo", connection)

  console.log("RPC Server started")
}

start()
