import {assert} from "chai"
import {createTestClient, startTestServer, testClient, testServer} from "./testUtils.js"
import WebSocket from "ws"

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
    await new Promise((r) => setTimeout(r, pingInterval * 2.5))

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
})
