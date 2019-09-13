import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, createRpcServer, ServerTopicImpl} from "../src"

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
        item: new ServerTopicImpl<{}, any>(async () => item)
      }
    }, rpcWebsocketServer)

    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => new WebSocket("ws://localhost:5555")
    })

    const r = await client.test.item.get({})

    assert.deepEqual(r, item)
  })
})