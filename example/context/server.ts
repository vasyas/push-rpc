import {createRpcServer, ServerTopicImpl} from "../../src"
import {Services, Todo, TodoService} from "../basic/shared"
import * as WebSocket from "ws"

interface ServiceContext {
  sql(): Promise<any>
  userId: string
}

let storage: Todo[] = []

class TodoServiceImpl implements TodoService {
  async addTodo({text}, ctx: ServiceContext) {
    storage.push({
      id: "" + Math.random(),
      text,
      status: "open",
    })

    console.log("New todo item added")

    this.todos.trigger()
  }

  todos = new ServerTopicImpl(async (_, ctx: ServiceContext) => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

function decodeToken(token) {
  return token
}

// TODO throw error if auth failed
const createContext = (req): ServiceContext => ({
  sql: null,
  userId: decodeToken(req.headers["Authentication"])
})

export async function startTransaction(ctx, next) {
  try {
    ctx.sql = async (query) => {
      console.log("Execeute query in DB", query)
    }

    await ctx.sql("begin")
    const r = await next()
    await ctx.sql("commit")
    return r
  } catch (e) {
    await ctx.sql("rollback")
    throw e
  }
}

const rpcWebsocketServer = new WebSocket.Server({port: 5555})
createRpcServer(services, rpcWebsocketServer, createContext, startTransaction)

console.log("RPC Server started at ws://localhost:5555")
