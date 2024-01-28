export type Services = {
  todo: TodoService
}

export type TodoService = {
  addTodo(req: {text: string}, ctx?: any): Promise<void>
  getTodos(ctx?: any): Promise<Todo[]>
}

export type Todo = {
  id: string
  text: string
  status: "open" | "closed"
}

