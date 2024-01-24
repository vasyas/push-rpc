import {assert} from "chai"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils.js"
import {RpcErrors} from "../src/index.js"

describe("Misc", () => {
  it("Send array in parameter", async () => {
    let param

    const services = await startTestServer({
      async hello(p) {
        param = p
      },
    })

    const client = await createTestClient<typeof services>()

    await client.hello(["a"])
    assert.equal(typeof param, "object")
    assert.isArray(param)
  })

  it("Circular reference in params", async () => {
    let param: any

    const services = await startTestServer({
      async hello(p) {
        param = p
      },
    })

    const client = await createTestClient<typeof services>()

    const msg = {
      some: "string",
      ref: null as any,
    }
    msg.ref = msg

    await client.hello(msg)

    assert.equal(param.some, msg.some)
  })

  it("Circular reference in response", async () => {
    const msg = {
      some: "string",
      ref: null as any,
    }
    msg.ref = msg

    const services = await startTestServer({
      async hello() {
        return msg
      },
    })

    const client = await createTestClient<typeof services>()

    const r = await client.hello()

    assert.equal(r.some, msg.some)
  })

  it("date in response", async () => {
    const date = new Date()

    const msg = {
      date,
    }

    const services = await startTestServer({
      async hello() {
        return msg
      },
    })

    const client = await createTestClient<typeof services>()

    const r = await client.hello()

    assert.equal(r.date.getTime(), date.getTime())
  })

  it("date in params", async () => {
    const date = new Date()

    let receivedDate: Date | undefined

    const services = await startTestServer({
      async hello(d: Date) {
        receivedDate = d
      },
    })

    const client = await createTestClient<typeof services>()

    await client.hello(date)
    assert.equal(receivedDate!.getTime(), date.getTime())
  })

  it("null member in local", async () => {
    await startTestServer({
      nested: null,
    } as any)
  })

  it("recursive member in local", async () => {
    const local = {
      nested: null as unknown,
    }

    local.nested = local

    await startTestServer(local as any)
  })

  it("Non flat remote", async () => {
    const services = await startTestServer({
      async hello1() {
        return "yes1"
      },

      nested: {
        async hello2() {
          return "yes2"
        },
      },
    })

    const client = await createTestClient<typeof services>()

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

    const client = await createTestClient<any>()

    try {
      await client.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }

    try {
      await client.nested.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }

    try {
      await client.nested.nested2.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }
  })

  it("invoke with empty body", async () => {
    await startTestServer({
      async hello1() {
        return "yes1"
      },
    })

    const r = await fetch(`http://127.0.0.1:${TEST_PORT}/rpc/hello1`, {
      method: "POST",
    })

    console.log(r.status)

    const body = await r.text()
    assert.equal(body, "yes1")
  })
})
