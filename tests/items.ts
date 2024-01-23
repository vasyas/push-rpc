import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils.js"

describe("Item lookup", () => {
  it("first level", async () => {
    const services = await startTestServer({
      async hello() {
        return "yes"
      },
    })

    const client = await createTestClient<typeof services>()

    const r = await client.hello()
    assert.equal("yes", r)
  })

  it("nested", async () => {
    const services = await startTestServer({
      obj: {
        async hello() {
          return "yes"
        },
      },
    })

    const client = await createTestClient<typeof services>()
    const r = await client.obj.hello()
    assert.equal("yes", r)
  })
})
