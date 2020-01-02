import {Topic} from "@push-rpc/core"

export interface Services {
  auth: AuthService
  client: ClientService
  user: UserService
}

export interface Client {
  id: number
  name: string
  lastModified: Date
  status: ClientStatus
  gender: "m" | "f"
  icons: string[]
}

export interface Admin {
  id: number
}

export interface User {
  login: string
  account: AdminOrClient
}

export type AdminOrClient = Admin | Client

export enum ClientStatus {
  Active = "Active",
  Blocked = "Blocked",
}

export interface Page<T> {
  total: number
  rows: T[]
}

export interface AuthService {
  login(req: {username: string; password: string}, ctx?): Promise<{token: string}>
  sendResetPassword(req: {username: string}, ctx?): Promise<void>
}

export interface ClientService {
  getClient(req: {id: number}, ctx?): Promise<Client>
  getClients(_?, ctx?): Promise<Page<Client>>

  clients: Topic<Client[]>
  client: Topic<Client, {id: number}>
}

export interface UserService {
  getAllUsers(_?, ctx?): Promise<User[]>
}
