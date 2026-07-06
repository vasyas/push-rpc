import {assert} from "chai"
import * as net from "net"
import * as crypto from "crypto"
import WebSocket from "ws"
import {setTestCloseTimeout, WebSocketConnection} from "../src/client/WebSocketConnection.js"
import {adelay} from "../src/utils/promises.js"

describe("zombie socket", () => {
  let server: net.Server
  let serverSockets: net.Socket[] = []
  let connection: WebSocketConnection | null = null

  const NodeWebSocket = (global as any).WebSocket

  before(() => {
    ;(global as any).WebSocket = WebSocket
  })

  after(() => {
    ;(global as any).WebSocket = NodeWebSocket
  })

  beforeEach(async () => {
    serverSockets = []
    server = startZombieServer(serverSockets)
    await new Promise((resolve) => server.listen(0, () => resolve(null)))
  })

  afterEach(async () => {
    connection?.close()
    connection = null
    setTestCloseTimeout(null)
    // half-open sockets are never closed by the client - destroy so mocha can exit
    serverSockets.forEach((socket) => socket.destroy())
    server.close()
  })

  it("abandons socket and reconnects when close handshake never completes", async () => {
    setTestCloseTimeout(300)

    // hide terminate() to force the WHATWG code path (browsers, Node's built-in WebSocket)
    const RealWebSocket = (global as any).WebSocket
    ;(global as any).WebSocket = class extends RealWebSocket {
      terminate = undefined
    }

    try {
      const {connects, disconnects} = await runConnection(300)

      // dead connection detected via heartbeat, close 'hangs', socket is abandoned
      // after testCloseTimeout, and the connection is re-established
      assert.isAtLeast(disconnects.length, 1)
      assert.isAtLeast(connects.length, 2)
    } finally {
      ;(global as any).WebSocket = RealWebSocket
    }
  }).timeout(5000)

  it("terminates immediately when terminate() is available", async () => {
    const {connects, disconnects} = await runConnection(300)

    assert.isAtLeast(disconnects.length, 1)
    assert.isAtLeast(connects.length, 2)
  }).timeout(5000)

  async function runConnection(pingInterval: number) {
    const connects: number[] = []
    const disconnects: number[] = []
    const started = Date.now()

    connection = new WebSocketConnection(
      `ws://127.0.0.1:${(server.address() as net.AddressInfo).port}`,
      "test-client-id",
      {
        subscriptions: true,
        reconnectDelay: 50,
        errorDelayMaxDuration: 100,
        pingInterval,
      },
      async () => {},
      () => connects.push(Date.now() - started),
      () => disconnects.push(Date.now() - started),
    )

    void connection.connect()

    // heartbeat fires at pingInterval * 1.5 (no pings from the server),
    // then the socket is closed/abandoned and the connection is re-established
    await adelay(pingInterval * 1.5 + 1000)

    return {connects, disconnects}
  }
})

/**
 * Completes the WS handshake, never pings, and swallows all client frames including
 * the close frame, keeping TCP open — emulates a half-open (zombie) connection.
 */
function startZombieServer(sockets: net.Socket[]): net.Server {
  return net.createServer((socket) => {
    sockets.push(socket)

    let request = ""

    socket.on("data", (data) => {
      if (request === null) return // swallow everything post-handshake

      request += data.toString("binary")
      if (!request.includes("\r\n\r\n")) return

      const key = /Sec-WebSocket-Key: (.+)\r\n/i.exec(request)![1].trim()
      const protocol = /Sec-WebSocket-Protocol: (.+)\r\n/i.exec(request)?.[1]?.trim()
      const accept = crypto
        .createHash("sha1")
        .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
        .digest("base64")

      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
          "Upgrade: websocket\r\n" +
          "Connection: Upgrade\r\n" +
          `Sec-WebSocket-Accept: ${accept}\r\n` +
          (protocol ? `Sec-WebSocket-Protocol: ${protocol}\r\n` : "") +
          "\r\n",
      )
      request = null as never
    })

    socket.on("error", () => {})
  })
}
