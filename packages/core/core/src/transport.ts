export interface Socket {
  onOpen(h: () => void)
  onError(h: (e) => void)
  onPong(h: () => void)
  onPing(h: () => void)

  disconnect()
  onDisconnected(h: (code, reason) => void)

  send(data: string)
  onMessage(h: (message: string) => void)
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
