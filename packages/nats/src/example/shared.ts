export interface Services {
  todo: TodoService
}

export interface TodoService {
  getHello(): Promise<string>
}
