import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("calls", () => {
  it("success", async () => {
    const resp = {r: "asf"}

    const invocation = {
      req: null,
      ctx: null,
    }

    await startTestServer({
      test: {
        async getSomething(req, ctx) {
          invocation.req = req
          invocation.ctx = ctx
          return resp
        },
      },
    })

    const client = await createTestClient()

    const req = {key: "value"}
    const r = await client.test.getSomething(req)

    assert.deepEqual(invocation.req, req)
    assert.deepEqual(r, resp)
  })

  it("error", async () => {
    const message = "bla"

    await startTestServer({
      test: {
        async getSomething() {
          throw new Error(message)
        },
      },
    })

    const client = await createTestClient()

    try {
      await client.test.getSomething()
      assert.fail()
    } catch (e) {
      assert.equal(e.message, message)
    }
  })

  it("timeout", async () => {
    await startTestServer({
      test: {
        async longOp() {
          await new Promise(r => setTimeout(r, 3 * 60 * 1000))
        },
      },
    })

    const client = await createTestClient()

    try {
      await client.test.longOp()
      assert.fail()
    } catch (e) {
      assert.equal(e.message, "Timeout")
    }
  })
})
