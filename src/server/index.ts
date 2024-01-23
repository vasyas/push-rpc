import {RemoteFunction, Services} from "../rpc.js"
import {LocalSubscriptions} from "./LocalSubscriptions.js"
import {withTriggers} from "./local.js"

export type ServicesWithTriggers<T extends Services> = {
  [K in keyof T]: T[K] extends Services
    ? ServicesWithTriggers<T[K]>
    : T[K] extends RemoteFunction
      ? T[K] & {trigger(filter?: Partial<Parameters<T[K]>[0]>): void}
      : never
}


export type RpcServer = {
  shutdown(): Promise<void>
}

export type PublishServicesOptions = {
  port: number
  path: string
}

export async function publishServices<S extends Services>(
  services: S,
  options: Partial<PublishServicesOptions> = {}
): Promise<{
  server: RpcServer,
  services: ServicesWithTriggers<S>
}> {
  const localSubscriptions = new LocalSubscriptions()

  return {
    services: withTriggers(localSubscriptions, services)
  }
}