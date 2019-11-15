import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, createRpcServer, LocalTopicImpl} from "../src"

describe("Topics", () => {
  let rpcWebsocketServer: WebSocket.Server

  beforeEach(() => new Promise(resolve => {
    rpcWebsocketServer = new WebSocket.Server({port: 5555})
    rpcWebsocketServer.addListener("listening", resolve)
  }))

  afterEach(() => new Promise(resolve => {
    rpcWebsocketServer.close(resolve)
  }))

  it("get", async () => {
    const item = {r: "asf"}

    createRpcServer({
      test: {
        item: new LocalTopicImpl<{}, any>(async () => item)
      }
    }, rpcWebsocketServer)

    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => new WebSocket("ws://localhost:5555")
    })

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

    createRpcServer(server, rpcWebsocketServer)

    let clientSocket: WebSocket

    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => {
        clientSocket = new WebSocket("ws://localhost:5555")
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