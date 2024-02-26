import {assert} from "chai"
import {createTestClient, startTestServer, TEST_PORT, testClient, testServer} from "./testUtils.js"
import WebSocket from "ws"
import {adelay} from "../src/utils/promises.js"
import http from "http"
import {parseCookies} from "../src/utils/cookies.js"

describe("connection", () => {
  it("server close connection on ping timeout", async () => {
    let oldPing: typeof WebSocket.prototype.ping

    oldPing = WebSocket.prototype.ping
    WebSocket.prototype.ping = () => {}

    const pingInterval = 100

    const services = await startTestServer(
      {
        test: {
          async call() {},
        },
      },
      {
        pingInterval,
      }
    )

    const remote = await createTestClient<typeof services>({
      reconnectDelay: pingInterval * 4, // so we don't reconnect fast and can catch disconnected state
    })

    await remote.test.call.subscribe(() => {})
    assert.equal(testServer?._allSubscriptions().length, 1)

    // wait for timeout
    await adelay(pingInterval * 2.5)

    // should be closed
    assert.equal(testServer?._allSubscriptions().length, 0)

    WebSocket.prototype.ping = oldPing
  }).timeout(5000)

  it("client close connection on ping timeout", async () => {
    const pingInterval = 100 // less than server pings, so client will close connection first

    const services = await startTestServer({
      test: {
        async call() {},
      },
    })

    const remote = await createTestClient<typeof services>({
      pingInterval,
      reconnectDelay: pingInterval * 4, // so we don't reconnect fast and can catch disconnected state
    })

    await remote.test.call.subscribe(() => {})

    assert.equal(testClient?.isConnected(), true)

    // wait for timeout
    await new Promise((r) => setTimeout(r, pingInterval * 2))

    // should be closed
    assert.equal(testClient?.isConnected(), false)
  })

  it("client reconnects on disconnect", async () => {
    const pingInterval = 100 // less than server pings, so client will close connection first

    const services = await startTestServer({
      test: {
        async call() {},
      },
    })

    const remote = await createTestClient<typeof services>({
      pingInterval,
      reconnectDelay: 0, // will reconnect after failed ping
    })

    await remote.test.call.subscribe(() => {})

    assert.equal(testClient!.isConnected(), true)

    // wait for timeout
    await new Promise((r) => setTimeout(r, pingInterval * 2))

    // should be reconnected again
    assert.equal(testClient!.isConnected(), true)
  })

  it("close will stop reconnection loop", async () => {
    const services = await startTestServer({
      item: async () => "1",
    })

    const remote = await createTestClient<typeof services>()

    await remote.item.subscribe(() => {})

    assert.equal(testClient!.isConnected(), true)

    await testClient!.close()

    assert.equal(testClient!.isConnected(), false)
  })

  it("calls listeners", async () => {
    const services = await startTestServer({
      item: async () => "1",
    })

    let connected = false
    let disconnected = false

    const remote = await createTestClient<typeof services>({
      onConnected: () => {
        connected = true
      },
      onDisconnected: () => {
        disconnected = true
      },
    })

    await remote.item.subscribe(() => {})

    assert.equal(connected, true)

    await testClient!.close()

    await adelay(10)

    assert.equal(disconnected, true)
  })

  describe("cookies", () => {
    it("handle cookies in subseq requests", async () => {
      let call = 0

      let sentClientCookies: Record<string, string> = {}

      const httpServer = http.createServer((req, res) => {
        const headers: Record<string, string> = {"Content-Type": "text/plain"}

        if (!call++) {
          headers["Set-Cookie"] = `name=value; path=/; secure; samesite=none; httponly`
        } else {
          sentClientCookies = parseCookies(req.headers.cookie || "")
        }

        res.writeHead(200, headers)

        res.end("ok")
      })

      let resolveStarted = () => {}
      const started = new Promise<void>((r) => (resolveStarted = r))
      httpServer.listen(TEST_PORT, () => resolveStarted())
      await started

      const client = await createTestClient<{call(): Promise<string>}>()

      await client.call()
      await client.call()

      assert.equal(Object.keys(sentClientCookies).length, 1)
      assert.equal(sentClientCookies["name"], "value")

      let resolveStopped = () => {}
      const stopped = new Promise<void>((r) => (resolveStopped = r))
      httpServer.closeAllConnections()
      httpServer.close(() => resolveStopped())
      await stopped
    })
  })
})
