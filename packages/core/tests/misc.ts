import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"
import {RpcConnectionContext} from "../src"
import {prepareLocal} from "../src/local"

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

  it("websocket misses 1st message due to async init", async () => {
    await startTestServer(
      {
        async hello() {
          return "ok"
        },
      },
      {
        async createConnectionContext(): Promise<RpcConnectionContext> {
          await new Promise(resolve => setTimeout(resolve, 50))

          return {
            remoteId: "remote",
          }
        },
      }
    )

    const client = await createTestClient(0)

    const r = await client.hello()
    console.log(r)
  })

  it("null member in local", async () => {
    const local = {
      nested: null,
    }

    prepareLocal(local)
  })

  it("recursive member in local", async () => {
    const local = {
      nested: null,
    }

    local.nested = local

    prepareLocal(local)
  })

  it("Non flat remote", async () => {
    await startTestServer({
      async hello1() {
        return "yes1"
      },

      nested: {
        async hello2() {
          return "yes2"
        },
      },
    })

    const client = await createTestClient(0)

    assert.equal("yes1", await client.hello1())
    assert.equal("yes2", await client.nested.hello2())
  })

  it("Item not found", async () => {
    await startTestServer({
      async hello1() {
        return "yes1"
      },

      nested: {
        async hello2() {
          return "yes2"
        },
      },
    })

    const client = await createTestClient(0)

    try {
      await client.hello()
      assert.fail("Error expected")
    } catch (e) {
      assert.include(e.message, "not implemented")
    }

    try {
      await client.nested.hello()
      assert.fail("Error expected")
    } catch (e) {
      assert.include(e.message, "not implemented")
    }

    try {
      await client.nested.nested2.hello()
      assert.fail("Error expected")
    } catch (e) {
      assert.include(e.message, "not implemented")
    }
  })
})
