import {Todo, TodoService} from "./api"
import {publishServices} from "../src/server/index"
import {RemoteFunction} from "../src/rpc"

const storage: Todo[] = []

async function startServer() {
  class TodoServiceImpl implements TodoService {
    async addTodo({text}: {text: string}) {
      storage.push({
        id: "" + Math.random(),
        text,
        status: "open",
      })

      console.log("New todo item added")
      services.todo.getTodos.trigger()
    }

    async getTodos() {
      return storage
    }

    [key: string]: RemoteFunction // TODO get rid of this
  }

  const {services} = await publishServices(
    {
      todo: new TodoServiceImpl(),
    },
    {
      port: 8080,
      path: "/rpc",
    }
  )

  console.log("RPC Server started at http://localhost:8080/rpc")
}

startServer()
