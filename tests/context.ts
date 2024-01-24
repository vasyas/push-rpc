import {createTestClient, startTestServer} from "./testUtils.js"
import {assert} from "chai"

describe("context", () => {
  it("available in call", async () => {
    let ctx = null

    const services = await startTestServer({
      test: {
        async call(passedCtx?: any) {
          ctx = passedCtx
        },
      },
    })

    const client = await createTestClient<typeof services>()

    await client.test.call()

    assert.ok(ctx)
    assert.ok(ctx!.clientId)
  })
})
