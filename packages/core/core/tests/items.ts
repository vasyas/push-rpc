import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("Item lookup", () => {
  it("first level", async () => {
    await startTestServer({
      async hello() {
        return "yes"
      }
    })

    const client = await createTestClient(0)

    const r = await client.hello()
    assert.equal("yes", r)
  })

  it("nested", async () => {
    await startTestServer({
      obj: {
        async hello() {
          return "yes"
        }
      }
    })

    const client = await createTestClient()
    const r = await client.obj.hello()
    assert.equal("yes", r)
  })
})