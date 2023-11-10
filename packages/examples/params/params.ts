import {createRpcServer, LocalTopicImpl, Topic} from "@push-rpc/core"
import {createWebsocketServer} from "@push-rpc/websocket"
import {createRpcClient} from "@push-rpc/core"
import {createNodeWebsocket} from "@push-rpc/websocket"

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
  const {remote: services} = await createRpcClient(async () =>
    createNodeWebsocket("ws://localhost:5555")
  )

  console.log("Client connected")

  services.todo.todo.subscribe(
    todo => {
      console.log("Got todo", todo)
    },
    {id: "" + 1}
  )

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

  createRpcServer(services, createWebsocketServer({port: 5555}))
}
