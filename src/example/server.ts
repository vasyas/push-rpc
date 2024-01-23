import {Todo, TodoService} from "./api.js"
import {createRpcServer} from "@push-rpc/core"
import {log} from "@push-rpc/core"
import {Middleware} from "@push-rpc/core"
import {ComboServerTransport} from "@push-rpc/combo"
import {RemoteFunction} from "@push-rpc/core"

async function start() {
  let storage: Todo[] = []

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

  const logErrors: Middleware = async (next, ...params) => {
    try {
      return await next(...params)
    } catch (err) {
      log.error(err)
      throw err
    }
  }

  const {services} = await createRpcServer(
    {
      todo: new TodoServiceImpl(),
    },
    [logErrors]
  )

  console.log("RPC Server started at http://localhost:8080/rpc")
}

start()
