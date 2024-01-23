import {Todo, TodoService} from "./api.js"
import {publishServices} from "../server/index.js"
import {RemoteFunction} from "../rpc.js"

const storage: Todo[] = []

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

  [key: string]: RemoteFunction // TODO is there a way to skip this?
}

const {services} = await publishServices(
  {
    todo: new TodoServiceImpl(),
  },
  {
    port: 8080,
    path: "/rpc"
  }
)

console.log("RPC Server started at http://localhost:8080/rpc")
