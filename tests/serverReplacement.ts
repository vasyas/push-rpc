import {assert} from "chai"
import {AddressInfo} from "node:net"
import WebSocket, {WebSocketServer} from "ws"
import {publishServices} from "../src/index.js"
import {CLIENT_ID_HEADER, PING_MSG, PONG_MSG} from "../src/rpc.js"
import {until} from "./recoveryUtils.js"

describe("server connection replacement", () => {
  it("preserves subscriptions, pushes and heartbeats after an old socket closes late", async () => {
    const {server, services, httpServer} = await publishServices(
      {topic: async () => "initial"},
      {port: 0, host: "127.0.0.1", path: "/rpc", pingInterval: 40},
    )
    services.topic.throttle({timeout: 0})
    const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/rpc`
    const clientId = "replacing-client"
    const clients: WebSocket[] = []
    const values: string[] = []
    let replacementPings = 0
    let restoreTerminate = () => {}

    const connect = async (replacement = false) => {
      const socket = new WebSocket(url.replace("http:", "ws:"), clientId)
      clients.push(socket)
      socket.on("message", (data) => {
        if (data.toString() === PING_MSG) {
          if (replacement) replacementPings++
          socket.send(PONG_MSG)
        } else if (replacement) {
          values.push(JSON.parse(data.toString())[1])
        }
      })
      await new Promise<void>((resolve, reject) => {
        socket.once("open", resolve)
        socket.once("error", reject)
      })
      return socket
    }
    const subscribe = async () => {
      const response = await fetch(`${url}/topic`, {
        method: "PUT",
        headers: {"Content-Type": "application/json", [CLIENT_ID_HEADER]: clientId},
        body: "[]",
      })
      assert.equal(response.status, 200)
      assert.equal(await response.text(), "initial")
    }

    try {
      const old = await connect()
      await subscribe()
      const wss = (server as unknown as {connectionsServer: {wss: WebSocketServer}})
        .connectionsServer.wss
      const previousSocket = [...wss.clients][0]
      const terminate = previousSocket.terminate
      let terminationRequested = false
      // Delay only the native teardown, preserving the actual server's connection,
      // subscription and heartbeat handling throughout the replacement.
      previousSocket.terminate = () => {
        terminationRequested = true
      }
      restoreTerminate = () => {
        previousSocket.terminate = terminate
      }
      const replacement = await connect(true)
      await subscribe()
      services.topic.trigger(undefined, "before-old-close")
      await until(() => values.includes("before-old-close"), "replacement receives pushes")

      const closed = new Promise<void>((resolve) => previousSocket.once("close", resolve))
      old.close()
      await closed
      assert.lengthOf(server._allSubscriptions(), 1, "old close preserves the current subscription")
      services.topic.trigger(undefined, "after-old-close")
      await until(() => values.includes("after-old-close"), "push survives the old close")
      const pingsAfterOldClose = replacementPings
      await until(
        () => replacementPings >= pingsAfterOldClose + 3,
        "replacement continues receiving heartbeats after the old close",
      )
      assert.equal(replacement.readyState, WebSocket.OPEN)
      services.topic.trigger(undefined, "after-heartbeats")
      await until(() => values.includes("after-heartbeats"), "pushes continue after heartbeats")
      assert.isTrue(terminationRequested, "server retires the superseded socket")
    } finally {
      restoreTerminate()
      for (const socket of clients) socket.terminate()
      await server.close()
    }
  })
})
