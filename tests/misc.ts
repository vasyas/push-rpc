import {assert} from "chai"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils.js"
import {RpcConnectionContext, RpcErrors} from "../src/index.js"
import {IncomingMessage} from "http"

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

    const remote: any = await createTestClient<any>()

    try {
      await remote.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }

    try {
      await remote.nested.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }

    try {
      await remote.nested.nested2.hello()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }
  })

  it("Object.prototype members and non-functions are not found", async () => {
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

    for (const itemName of [
      "__proto__/toString",
      "constructor",
      "nested/hasOwnProperty",
      "nested/__defineGetter__",
      "hello1/call",
      "nested",
    ]) {
      const response = await fetch(`http://127.0.0.1:${TEST_PORT}/rpc/${itemName}`, {
        method: "POST",
      })

      assert.equal(response.status, RpcErrors.NotFound, itemName)
    }
  })

  it("isRemoteItem limits remote items", async () => {
    let helperInvoked = false

    class Service {
      async hello() {
        return "yes"
      }

      async helper() {
        helperInvoked = true
        return "helper"
      }
    }

    await startTestServer(
      {service: new Service()},
      {isRemoteItem: (itemName) => itemName == "service/hello"},
    )

    const remote: any = await createTestClient<any>()

    assert.equal(await remote.service.hello(), "yes")

    try {
      await remote.service.helper()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.NotFound)
    }

    // subscribe goes through the same lookup
    const response = await fetch(`http://127.0.0.1:${TEST_PORT}/rpc/service/helper`, {
      method: "PUT",
    })
    assert.equal(response.status, RpcErrors.NotFound)

    assert.isFalse(helperInvoked)
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

    const body = await r.text()
    assert.equal(body, "yes1")
  })

  it("non array in params converts to 1st param", async () => {
    let param: any

    await startTestServer({
      async hello1(param1) {
        param = param1
      },
    })

    await fetch(`http://127.0.0.1:${TEST_PORT}/rpc/hello1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({param1: "yes1"}),
    })

    assert.deepEqual(param, {param1: "yes1"})
  })

  it("pass headers to server", async () => {
    let userName: string | undefined

    const services = await startTestServer(
      {
        async hello1(ctx?) {
          userName = ctx.userName
        },
      },
      {
        async createConnectionContext(
          req: IncomingMessage,
        ): Promise<RpcConnectionContext & {userName: string}> {
          return {
            clientId: "test",
            userName: req.headers["x-user-name"] as string,
          }
        },
      },
    )

    const remote = await createTestClient<typeof services>({
      async getHeaders() {
        return {
          ["X-User-Name"]: "testUser",
        }
      },
    })

    await remote.hello1()

    assert.equal(userName, "testUser")
  })
})
