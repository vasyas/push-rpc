import {assert} from "chai"
import {createServer, ServerResponse} from "node:http"
import {AddressInfo, Socket} from "node:net"
import WebSocket, {WebSocketServer} from "ws"
import {consumeServices, ConsumeServicesOptions} from "../src/client/index.js"
import {getClientId} from "../src/index.js"
import {adelay} from "../src/utils/promises.js"

export async function until(predicate: () => boolean, description: string, timeout = 1000) {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    assert.isBelow(Date.now(), deadline, description)
    await adelay(5)
  }
}

// A loopback-only HTTP/WS peer lets tests independently release old HTTP snapshots,
// opening handshakes and native close callbacks without relying on timing in the OS.
export async function recoveryFixture(options: Partial<ConsumeServicesOptions> = {}) {
  const savedWebSocket = globalThis.WebSocket
  const clientSockets: NativeSocket[] = []
  class NativeSocket extends WebSocket {
    hangClose = false

    constructor(address: string, protocols: string) {
      super(address, protocols)
      // React Native and browsers expose close(), but not ws's terminate().
      Object.defineProperty(this, "terminate", {value: undefined})
      clientSockets.push(this)
    }

    close(code?: number, reason?: string | Buffer) {
      if (this.hangClose) return
      super.close(code, reason)
    }
  }
  globalThis.WebSocket = NativeSocket as unknown as typeof globalThis.WebSocket

  const tcpSockets = new Set<Socket>()
  const sessions = new Map<string, {ws: WebSocket; topics: Map<string, unknown[]>}>()
  const connections: WebSocket[] = []
  const pending: ServerResponse[] = []
  const requests: Array<{itemName: string; parameters: unknown[]}> = []
  const state = {value: "initial", holdNext: false, holdAll: false, holdUpgrade: false, upgrades: 0}
  const wss = new WebSocketServer({noServer: true})
  const server = createServer(async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    const parameters = JSON.parse(body || "[]") as unknown[]
    const clientId = getClientId(req) ?? ""
    const itemName = req.url!.replace("/rpc/", "")
    if (req.method === "PUT") {
      requests.push({itemName, parameters})
      sessions.get(clientId)?.topics.set(itemName, parameters)
      if (state.holdNext || state.holdAll) {
        state.holdNext = false
        pending.push(res)
        return
      }
    }
    if (req.method === "PATCH") sessions.get(clientId)?.topics.delete(itemName)
    reply(res, state.value)
  })
  server.on("connection", (socket) => {
    tcpSockets.add(socket)
    socket.on("close", () => tcpSockets.delete(socket))
  })
  server.on("upgrade", (req, socket, head) => {
    state.upgrades++
    if (state.holdUpgrade) return
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req))
  })
  wss.on("connection", (ws, req) => {
    const clientId = getClientId(req) ?? ""
    sessions.set(clientId, {ws, topics: new Map()})
    connections.push(ws)
    ws.on("close", () => {
      if (sessions.get(clientId)?.ws === ws) sessions.delete(clientId)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const {client, remote} = await consumeServices<{topic: (id: number) => Promise<string>}>(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/rpc`,
    {pingInterval: 30000, callTimeout: 3000, errorDelayMaxDuration: 0, ...options},
  )

  return {
    client,
    remote,
    state,
    clientSockets,
    connections,
    pending,
    requests,
    publish(value: string) {
      for (const {ws, topics} of sessions.values()) {
        if (ws.readyState === WebSocket.OPEN && topics.has("topic")) {
          ws.send(JSON.stringify(["topic", value, ...topics.get("topic")!]))
        }
      }
    },
    async close() {
      for (const socket of clientSockets) socket.hangClose = false
      const closing = client.close()
      for (const socket of tcpSockets) socket.destroy()
      await closing
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      await new Promise<void>((resolve) => server.close(() => resolve()))
      globalThis.WebSocket = savedWebSocket
    },
  }
}

export type RecoveryFixture = Awaited<ReturnType<typeof recoveryFixture>>

export function reply(response: ServerResponse, value: string, status = 200) {
  response.statusCode = status
  response.setHeader("Content-Type", "application/json")
  response.end(JSON.stringify(value))
}
