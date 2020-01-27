import {RpcSession} from "./RpcSession"

export interface Socket {
  onMessage(h: (message: string) => void)
  onOpen(h: () => void)
  onClose(h: (code, reason) => void)
  onError(h: (e) => void)
  onPong(h: () => void)

  terminate()
  send(data: string)
  ping(data: string)
}

export interface SocketServer {
  onError(h: (e) => void): void
  onConnection(
    h: (socket: Socket, ...transportDetails: any) => Promise<void>,
    isConnected: (remoteId: string) => boolean
  ): void
  close(cb): void
}
