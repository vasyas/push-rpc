import {Topic} from "@push-rpc/core"

export interface Services {
  todo: TodoService
}

export interface TodoService {
  todos: Topic<Todo[]>
}

export interface Todo {
  id: string
  text: string
  status: "open" | "closed"
}
