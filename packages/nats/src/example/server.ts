import {connect, NatsConnection} from "nats"
import {NatsTransport} from "../nats"
import {createRpcServer, LocalTopicImpl} from "../server"
import {Services, TodoService, Todo} from "./shared"

async function start() {
  let storage: Todo[] = [
    {
      id: 1,
      text: "first",
    },
    {
      id: 2,
      text: "second",
    },
  ]

  class TodoServiceImpl implements TodoService {
    async update({id, text}) {
      storage.find(t => t.id == id).text = text

      this.todos.trigger({id})
    }

    todos = new LocalTopicImpl(async ({id}) => storage.find(t => t.id == id))
  }

  const services: Services = {
    todo: new TodoServiceImpl(),
  }

  const connection: NatsConnection = await connect()
  const transport = new NatsTransport("demo", connection)

  await createRpcServer(services, transport)

  console.log("RPC Server started")
}

start()
