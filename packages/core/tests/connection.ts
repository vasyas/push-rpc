import {assert} from "chai"
import {createNodeWebsocket} from "../../websocket/src"
import {createRpcClient} from "../src"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils"

describe("connection", () => {
  it("server close connection on keep alive timeout", async () => {
    const keepAliveTimeout = 1000

    const rpcServer = await startTestServer(
      {
        test: {
          async call() {},
        },
      },
      {
        keepAliveTimeout,
      }
    )

    const client = await createTestClient()

    await client.test.call()
    assert.equal(rpcServer.getConnectedIds().length, 1)

    // wait for timeout
    await new Promise(r => setTimeout(r, keepAliveTimeout * 2.5))

    // should be closed
    assert.equal(rpcServer.getConnectedIds().length, 0)
  }).timeout(5000)

  it("disconnect will stop reconnection loop", async () => {
    await startTestServer({})

    const rpcClient = await createRpcClient(
      1,
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {reconnect: true}
    )

    rpcClient.disconnect()
  })

  it("disconnect of prev connection happens before reconnect", async () => {
    let connectionsHistory = []

    const rpcServer = await startTestServer(
      {
        test: {
          async call() {},
        },
      },
      {
        createConnectionContext: async (socket, ...transportDetails) => ({
          remoteId: "1",
        }),
        listeners: {
          connected(remoteId: string, connections: number) {
            connectionsHistory.push("C")
          },
          disconnected(remoteId: string, connections: number) {
            connectionsHistory.push("D")
          },
          messageOut(remoteId: string, data: string) {},
          messageIn(remoteId: string, data: string) {},
          unsubscribed(subscriptions: number) {},
          subscribed(subscriptions: number) {},
        },
      }
    )

    await createTestClient()
    await createTestClient()

    await new Promise(r => setTimeout(r, 500))

    await rpcServer.disconnectClient("1")

    assert.equal(rpcServer.getConnectedIds().length, 0)
    assert.deepEqual(connectionsHistory, ["C", "D", "C", "D"])
  })

  it("server returns http error on handshake doesn't break connection loop", async () => {
    let verified = false

    await startTestServer(
      {},
      {},
      {
        verifyClient: (info, done) => {
          done(verified)
        },
      }
    )

    let connected = false,
      failed = false

    const clientPromise = createRpcClient(
      1,
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {
        reconnect: true,
        errorDelayMaxDuration: 100,
      }
    )

    clientPromise.then(
      client => {
        connected = true
        return client
      },
      () => {
        failed = true
      }
    )

    await new Promise(r => setTimeout(r, 300))

    // still trying to reconnect
    assert.isFalse(connected)
    assert.isFalse(failed)

    // let it go to finish the test
    verified = true

    await clientPromise.then(client => client.disconnect())
  })

  it("connection ready right after connect", async () => {
    const rpcServer = await startTestServer({
      test: {
        async call() {},
      },
    })

    const client = await createTestClient()

    await client.test.call()
    assert.equal(rpcServer.getConnectedIds().length, 1)
  })
})
