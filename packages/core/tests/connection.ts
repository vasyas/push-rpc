import {assert} from "chai"
import {createNodeWebsocket} from "../../websocket/src"
import {createRpcClient, RpcClient, Socket} from "../src"
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
    const connectionsHistory = []

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

  it("unexpected-response not breaking reconnection cycle", async () => {
    const connectionsHistory = []
    let connecting = true

    const rpcServer = await startTestServer(
      {
        test: {
          async call() {},
        },
      },
      {
        createConnectionContext: async () => ({
          remoteId: "1",
        }),
      },
      {
        verifyClient: (info, done) => {
          if (connecting) {
            console.log("Connected ok")
            done(true)
          } else {
            console.log("Refusing to connect")
            done(false, 403, `error`)
          }
        },
      }
    )

    const client = await createRpcClient(
      async () => {
        return createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
      },
      {
        reconnect: true,
        errorDelayMaxDuration: 10,
        listeners: {
          connected() {
            connectionsHistory.push("C")
          },
          disconnected() {
            connectionsHistory.push("D")
          },
          messageIn() {},
          messageOut() {},
          subscribed() {},
          unsubscribed() {},
        },
      }
    )

    assert.equal(rpcServer.getConnectedIds().length, 1)

    connecting = false
    await rpcServer.disconnectClient("1")
    await new Promise(r => setTimeout(r, 15)) // at least one reconnect

    assert.equal(rpcServer.getConnectedIds().length, 0) // but failed

    connecting = true
    await new Promise(r => setTimeout(r, 15))
    assert.equal(rpcServer.getConnectedIds().length, 1)

    await client.disconnect()
  }).timeout(5000)

  it("wait for call when disconnected", async () => {
    let client: RpcClient<any>

    try {
      const server = await startTestServer({
        test: {
          async getSomething() {
            return "ok"
          },
        },
      })

      let response

      client = await createRpcClient(
        async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
        {
          reconnect: true,
        }
      )

      // disconnect
      await server.disconnectClient(server.getConnectedIds()[0])

      // give some time for client to catch disconnect
      await new Promise(r => setTimeout(r, 10))

      client.remote.test.getSomething().then(r => {
        response = r
      })

      // wait for reconnect & call
      await new Promise(r => setTimeout(r, 50))

      assert.equal(response, "ok")
    } finally {
      await client.disconnect()
    }
  })

  it("out of band client connect/disconnect", async () => {
    let connectionsHistory = []

    const rpcServer = await startTestServer({
      test: {
        async call() {},
      },
    })

    const client = await createRpcClient(
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {
        reconnect: true,
        reconnectDelay: 0,
        listeners: {
          connected() {
            connectionsHistory.push("C")
          },
          disconnected() {
            connectionsHistory.push("D")
          },
          messageOut() {},
          messageIn() {},
          unsubscribed() {},
          subscribed() {},
        },
      }
    )

    await rpcServer.disconnectClient(rpcServer.getConnectedIds()[0])

    await new Promise(r => setTimeout(r, 100))

    await client.disconnect()

    await new Promise(r => setTimeout(r, 100))

    assert.deepEqual(connectionsHistory, ["C", "D", "C", "D"])
  })

  it("connection timeout generates correct events`", async () => {
    let connectionsHistory = []

    let connection = 0

    const connectionTimeout = 200

    const rpcServer = await startTestServer(
      {
        test: {
          async call() {},
        },
      },
      {
        createConnectionContext: async () => ({
          remoteId: "client",
        }),
      }
    )

    const client = await createRpcClient(
      async () => {
        const socket = createNodeWebsocket(`ws://localhost:${TEST_PORT}`)

        connection++
        // console.log("Create socket, connection " + connection)

        if (connection == 2) {
          // simulate connection timeout
          const realOnOpen = socket.onOpen
          let timer = null
          socket.onOpen = h => {
            realOnOpen.call(socket, () => {
              timer = setTimeout(h, connectionTimeout + 200)
            })
          }

          const realDisconnect = socket.disconnect
          socket.disconnect = () => {
            clearTimeout(timer)
            realDisconnect.call(socket)
          }
        }

        return socket
      },
      {
        reconnect: true,
        reconnectDelay: 0,
        errorDelayMaxDuration: 0,
        connectionTimeout,
        listeners: {
          connected() {
            connectionsHistory.push("C")
          },
          disconnected() {
            connectionsHistory.push("D")
          },
          messageOut() {},
          messageIn() {},
          unsubscribed() {},
          subscribed() {},
        },
      }
    )

    await rpcServer.disconnectClient(rpcServer.getConnectedIds()[0])

    await new Promise(r => setTimeout(r, 1500))

    // console.log(connectionsHistory)

    assert.deepEqual(connectionsHistory, ["C", "D", "C"])

    await client.disconnect()
  })
})
