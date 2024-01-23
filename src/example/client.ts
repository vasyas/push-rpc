import {Services} from "./api.js"
import {consumeServices} from "../client/index.js"

const {remote} = await consumeServices<Services>("http://127.0.0.1:8080/rpc", {
  waitSubscribe: true
})

console.log("Client created")

await remote.todo.getTodos.subscribe((todos) => {
  console.log("Got todo items", todos)
}, null)

await remote.todo.addTodo({text: "Buy groceries"})
