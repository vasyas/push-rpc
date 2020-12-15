import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("Misc", () => {
  it("Call parameter is not modified", async () => {
    await startTestServer({
      async hello() {
        return "yes"
      },
    })

    const client = await createTestClient(0)

    const req = {
      when: new Date(),
    }

    await client.hello(req)
    assert.equal(typeof req.when, "object")
  })
})
