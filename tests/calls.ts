import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, createRpcServer} from "../src"

describe("Calls", () => {
  let rpcWebsocketServer: WebSocket.Server

  beforeEach(() => new Promise(resolve => {
    rpcWebsocketServer = new WebSocket.Server({port: 5555})
    rpcWebsocketServer.addListener("listening", resolve)
  }))

  afterEach((cb) => {
    rpcWebsocketServer.close(cb)
    process.exit(0)
  })

  it("call void method", async () => {
    const invocation = {
      req: null,
      ctx: null,
    }

    createRpcServer({
      test: {
        async saveObject(req, ctx) {
          invocation.req = req
          invocation.ctx = ctx
        }
      }
    }, rpcWebsocketServer)

    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => new WebSocket("ws://localhost:5555")
    })

    const req = {key: "value"}
    await client.test.saveObject(req)

    await new Promise(resolve => setTimeout(resolve, 1000))

    assert.deepEqual(invocation.req, req)
  })
})