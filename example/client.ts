import {Services} from "./api"
import {consumeServices} from "../src/client/index"

async function startClient() {
  const {remote} = await consumeServices<Services>("http://127.0.0.1:8080/rpc")

  console.log("Client created")

  await remote.todo.getTodos.subscribe((todos) => {
    console.log("Got todo items", todos)
  })

  await remote.todo.addTodo({text: "Buy groceries"})
}

startClient()
