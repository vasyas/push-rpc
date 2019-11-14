export interface Server {
  getServerHello(): Promise<string>
}

export interface Client {
  getClientHello(): Promise<string>
}
