import {createRpcServer, ServerTopicImpl, setLogger} from "../../src/index"
import {Services, Todo, TodoService} from "./shared"

setLogger(console)

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

  todos = new ServerTopicImpl(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

const server = createRpcServer(services, {wss: {port: 5555}})

console.log("RPC Server started at ws://localhost:5555")