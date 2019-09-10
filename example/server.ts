import {createRpcServer, ServerTopic} from "../src/index"
import {Services, TodoService, Todo} from "./shared"
import * as WebSocket from "ws"

let storage: Todo[] = []

class TodoServiceImpl implements TodoService {
  async addTodo({text}) {
    storage.push({
      id: "" + Math.random(),
      text,
      status: "open",
    })

    console.log("New todo item added")

    this.todos.trigger({})
  }

  todos = new ServerTopic(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

const rpcWebsocketServer = new WebSocket.Server({port: 5555})
createRpcServer(services, rpcWebsocketServer)

console.log("RPC Server started at ws://localhost:5555")
