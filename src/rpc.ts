import {ExtractPromiseResult} from "./utils/types.js"

export type RemoteFunction = (...args: any[]) => Promise<any>
export type Services<SubType> = {
  [K in keyof SubType]: Services<SubType[K]> | RemoteFunction
}

export type Consumer<T extends RemoteFunction> = (data: ExtractPromiseResult<ReturnType<T>>) => void

export class RpcError extends Error {
  constructor(
    public readonly code: number,
    message?: string,
  ) {
    super(message)
  }
}

export enum RpcErrors {
  NotFound = 404,
  Timeout = 504,
}

export class CallOptions {
  constructor(options: {timeout: number}) {
    this.timeout = options.timeout
  }

  public readonly timeout
  public readonly kind = CallOptions.KIND // to distinguish from other parameters in remote call

  public static KIND = "CallOptions"
}

export const CLIENT_ID_HEADER = "x-rpc-client-id"
export const ERROR_HEADER = "x-error"

export const PING_MSG = "PING"
export const PONG_MSG = "PONG"

export type RpcConnectionContext = {
  clientId: string
}

export type RpcContext = RpcConnectionContext & {
  itemName: string
  invocationType: InvocationType
}

export enum InvocationType {
  Call = "Call",
  Subscribe = "Subscribe",
  Unsubscribe = "Unsubscribe", // client only
  Update = "Update", // client only
  Trigger = "Trigger", // server only
}
