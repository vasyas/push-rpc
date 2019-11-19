import {createRpcClient, createRpcServer, LocalTopicImpl, Topic} from "../../src"
import * as WebSocket from "ws"

// shared
export interface Services {
  todo: TodoService
}

export interface TodoService {
  todo: Topic<Todo, {id: string}>
  update(todo: Partial<Todo>): Promise<void>
}

export interface Todo {
  id: string
  text: string
  status: "open" | "closed"
}


// client
async function createClient() {
  const services: Services = await createRpcClient(1, () => new WebSocket("ws://localhost:5555"))

  console.log("Client connected")

  services.todo.todo.subscribe((todo) => {
    console.log("Got todo", todo)
  }, {id: "" + 1})

  await services.todo.update({id: "1", text: "new text"})
}

// server
async function createServer() {
  let storage: Todo[] = []

  class TodoServiceImpl implements TodoService {
    todo = new LocalTopicImpl(async ({id}) => storage.find(t => t.id == id))

    async update(todo: Partial<Todo>) {
      const t = storage.find(t => t.id == todo.id)
      Object.assign(t, todo)

      this.todo.trigger({id: todo.id})
    }
  }

  const services: Services = {
    todo: new TodoServiceImpl(),
  }

  const rpcWebsocketServer = new WebSocket.Server({port: 5555})
  createRpcServer(services, rpcWebsocketServer)
}