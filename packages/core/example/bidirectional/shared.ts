import {RpcContext} from "../../src/rpc"

export interface Server {
  getServerHello(_?, ctx?: RpcContext): Promise<string>
}

export interface Client {
  getClientHello(): Promise<string>
}
