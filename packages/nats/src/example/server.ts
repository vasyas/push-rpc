import {connect, NatsConnection} from "nats"
import {createRpcServer} from "../nats"
import {Services, TodoService} from "./shared"

async function start() {
  class TodoServiceImpl implements TodoService {
    async getHello(): Promise<string> {
      return "hello"
    }
  }

  const services: Services = {
    todo: new TodoServiceImpl(),
  }

  const connection: NatsConnection = await connect()

  await createRpcServer(services, connection)

  console.log("RPC Server started")
}

start()
