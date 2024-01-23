import {Consumer, RemoteFunction, Services} from "../rpc.js"

export type ServicesWithSubscriptions<T extends Services> = {
  [K in keyof T]: T[K] extends Services
    ? ServicesWithSubscriptions<T[K]>
    : T[K] extends RemoteFunction
      ? T[K] & {subscribe(consumer: Consumer<T[K]>, ...parameters: Parameters<T[K]>): Promise<void>}
      : never
}

export type RpcClient = {
  shutdown(): Promise<void>
}

export async function consumeServices<S extends Services>(
  url: string
): Promise<{
  client: RpcClient
  remote: ServicesWithSubscriptions<S>
}> {
}