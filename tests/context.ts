import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, createRpcServer} from "../src"

describe("Context", () => {
  let rpcWebsocketServer: WebSocket.Server
  const sessionId = "5"
  const callId = "6"

  beforeEach(() => new Promise(resolve => {
    rpcWebsocketServer = new WebSocket.Server({port: 5555})
    rpcWebsocketServer.addListener("listening", resolve)
  }))

  afterEach(() => new Promise(resolve => {
    rpcWebsocketServer.close(resolve)
  }))

  it("pass session and call", async () => {
    const resp = {r: "asf"}

    const invocation = {
      req: null,
      ctx: null,
    }

    createRpcServer({
      test: {
        async getSomething(req, ctx) {
          invocation.req = req
          invocation.ctx = ctx
          return resp
        }
      }
    }, rpcWebsocketServer, () => ({
      sessionId,
    }), (ctx, next) => {
      ctx.callId = callId
      return next()
    })

    const client = await createRpcClient({
      level: 1,
      createWebSocket: () => new WebSocket("ws://localhost:5555")
    })

    const req = {key: "value"}
    const r = await client.test.getSomething(req)

    assert.deepEqual(invocation.ctx, {
      sessionId,
      callId,
    })

    assert.deepEqual(r, resp)
  })
})