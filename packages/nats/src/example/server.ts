import {connect, NatsConnection} from "nats"
import {Todo} from "../../../examples/basic/shared"
import {LocalTopicImpl} from "../core"
import {createRpcServer} from "../server"
import {Services, TodoService} from "./shared"

async function start() {
  let storage: Todo[] = []

  class TodoServiceImpl implements TodoService {
    async addTodo({text}) {
      storage.push({
        id: "" + Math.random(),
        text,
        status: "open",
      })

      console.log("New todo item added")

      this.todos.trigger()
    }

    todos = new LocalTopicImpl(async () => storage)
  }

  const services: Services = {
    todo: new TodoServiceImpl(),
  }

  const connection: NatsConnection = await connect()

  await createRpcServer(services, "demo", connection)

  console.log("RPC Server started")
}

start()
