import {RpcContext} from "@push-rpc/core"

export interface Server {
  getServerHello(_?, ctx?: RpcContext): Promise<string>
}

export interface Client {
  getClientHello(): Promise<string>
}
