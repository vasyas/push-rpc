import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("Context", () => {
  const sessionId = "5"
  const callId = "6"

  it("pass session and call", async () => {
    const resp = {r: "asf"}

    const invocation = {
      req: null,
      ctx: null,
    }

    await startTestServer(
      {
        test: {
          async getSomething(req, ctx) {
            invocation.req = req
            invocation.ctx = ctx
            return resp
          },
        },
      },
      {
        createConnectionContext: async () => ({sessionId}),
        localMiddleware: (ctx, next) => {
          ctx.callId = callId
          return next()
        },
      }
    )

    const client = await createTestClient()

    const req = {key: "value"}
    const r = await client.test.getSomething(req)

    assert.equal(invocation.ctx.sessionId, sessionId)
    assert.equal(invocation.ctx.callId, callId)

    assert.deepEqual(r, resp)
  })
})
