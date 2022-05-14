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

  it("Send array in parameter", async () => {
    let param

    await startTestServer({
      async hello(p) {
        param = p
      },
    })

    const client = await createTestClient(0)

    await client.hello(["a"])
    assert.equal(typeof param, "object")
    assert.isArray(param)
  })

  it("Circular reference in params", async () => {
    let param

    await startTestServer({
      async hello(p) {
        param = p
      },
    })

    const client = await createTestClient(0)

    const msg = {
      some: "string",
      ref: null,
    }
    msg.ref = msg

    await client.hello(msg)

    assert.equal(param.some, msg.some)
  })

  it("Circular reference in response", async () => {
    const msg = {
      some: "string",
      ref: null,
    }
    msg.ref = msg

    await startTestServer({
      async hello() {
        return msg
      },
    })

    const client = await createTestClient(0)

    const r = await client.hello()

    assert.equal(r.some, msg.some)
  })

  // and multiple objects
  it("multiple dates in response", async () => {
    const msg = {
      date1: new Date(),
      date2: new Date(),
    }

    await startTestServer({
      async hello() {
        return msg
      },
    })

    const client = await createTestClient(0)

    const r = await client.hello()
    console.log(r)
  })
})
