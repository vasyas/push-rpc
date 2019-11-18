import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("Calls", () => {
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
        }
      }
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
        }
      }
    })

    const client = await createTestClient()

    try {
      await client.test.getSomething({})
      assert.fail()
    } catch (e) {
      assert.equal(e.message, message)
    }
  })
})