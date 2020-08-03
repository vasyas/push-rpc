import {createRpcServer, LocalTopicImpl, setLogger} from "@push-rpc/core"
import {createWebsocketServer} from "@push-rpc/websocket"
import {Services, Todo, TodoService} from "./shared"

setLogger(console)

let storage: Todo[] = [
  {
    id: "1",
    status: "open",
    text: "Need to do it",
  },
]

class TodoServiceImpl implements TodoService {
  todos = new LocalTopicImpl(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

createRpcServer(services, createWebsocketServer({port: 5555}), {
  listeners: {
    unsubscribed(subscriptions: number): void {},
    subscribed(subscriptions: number): void {},
    disconnected(remoteId: string, connections: number): void {
      console.log(`Client ${remoteId} disconnected`)
    },
    connected(remoteId: string, connections: number): void {
      console.log(`New client ${remoteId} connected`)
    },
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
