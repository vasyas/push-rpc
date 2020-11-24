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
    const rpcClient = await createRpcClient(
      1,
      () => createNodeWebsocket(`wss://echo.websocket.org`),
      {
        reconnect: true
      }
    )

    rpcClient.disconnect()
  })
})