import {Topic} from "../../../core/src"

export interface Services {
  todo: TodoService
}

export interface TodoService {
  update({id, text}, ctx?): Promise<void>
  todos: Topic<Todo, {id: number}>
}

export interface Todo {
  id: number
  text: string
}
