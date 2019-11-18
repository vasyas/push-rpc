import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, LocalTopicImpl} from "../src"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils"

describe("Topics", () => {
  it("get", async () => {
    const item = {r: "asf"}

    await startTestServer({
      test: {
        item: new LocalTopicImpl<{}, any>(async () => item)
      }
    })

    const client = await createTestClient()

    const r = await client.test.item.get({})

    assert.deepEqual(r, item)
  })

  it("resubscribe", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl<typeof item, {}>(async () => item)
      }
    }

    await startTestServer(server)

    let clientSocket: WebSocket
    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => {
        clientSocket = new WebSocket(`ws://localhost:${TEST_PORT}`)
        return clientSocket
      }
    })

    let receivedItem

    await client.test.item.subscribe(item => {
      receivedItem = item
    })

    // first notificaiton right after subscription
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)

    // trigger sends item
    item.r = "2"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)

    // resubscribe
    clientSocket.close()
    await new Promise(resolve => setTimeout(resolve, 50))

    // session should be re-subscribed, trigger should continue to send items
    item.r = "3"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)
  })
})