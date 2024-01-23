import {createRpcClient} from "@push-rpc/core"
import {Services} from "./api.js"
import {ComboClientTransport} from "@push-rpc/combo"
;(async () => {
  const {remote} = await createRpcClient<Services>(
    new ComboClientTransport("http://localhost:8080/rpc")
  )

  console.log("Client created")

  await remote.todo.getTodos.subscribe((todos) => {
    console.log("Got todo items", todos)
  }, null)

  await remote.todo.addTodo({text: "Buy groceries"})
})().catch((e) => {
  console.error(e)
})
