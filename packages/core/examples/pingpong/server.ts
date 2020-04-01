import {createRpcServer, LocalTopicImpl, setLogger} from "@push-rpc/core"
import {createWebsocketServer} from "@push-rpc/websocket"
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

  todos = new LocalTopicImpl(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

createRpcServer(services, createWebsocketServer({port: 5555}), {
  listeners: {
    unsubscribed(subscriptions: number): void {},
    subscribed(subscriptions: number): void {},
    disconnected(remoteId: string, connections: number): void {},
    connected(remoteId: string, connections: number): void {},
    messageIn(...params): void {
      console.log("IN ", params)
    },
    messageOut(...params): void {
      console.log("OUT ", params)
    },
  },
  pingSendTimeout: null,
  keepAliveTimeout: null,
})

console.log("RPC Server started at ws://localhost:5555")
