export interface Server {
  getServerHello(): string
}

export interface Client {
  getClientHello(): string
}
