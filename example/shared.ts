import {Topic} from "../src/index"

export interface Services {
  todo: TodoService
}

export interface TodoService {
  addTodo({text}): Promise<void>
  todos: Topic<{}, Todo[]>
}

export interface Todo {
  id: string
  text: string
  status: "open" | "closed"
}
