export interface Services {
  todo: TodoService
}

export interface TodoService {
  getHello(i: number): Promise<string>
}
