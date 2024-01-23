import {assert} from "chai"
import {createTestClient, startTestServer, testRpcServer} from "./testUtils.js"
import {RpcErrors, Services} from "../src/index.js"

describe("calls", () => {
  it("client call server", async () => {
    const resp = {r: "asf"}

    const invocation = {
      req: null as unknown,
      ctx: null as unknown,
    }

    const services = await startTestServer({
      test: {
        async getSomething(req: unknown, ctx?: unknown) {
          invocation.req = req
          invocation.ctx = ctx
          return resp
        },
      },
    })

    const client = await createTestClient<typeof services>()

    const req = {key: "value"}
    const r = await client.test.getSomething(req)

    assert.deepEqual(invocation.req, req)
    assert.deepEqual(r, resp)
  })

  it("server call client", async () => {
    const resp = {r: "asf"}

    const invocation = {
      req: null as unknown,
      ctx: null as unknown,
    }

    const services = await startTestServer({})

    const client = await createTestClient<typeof services>({
      test: {
        async getSomething(req: unknown, ctx?: unknown) {
          invocation.req = req
          invocation.ctx = ctx
          return resp
        },
      },
    })

    const req = {key: "value"}
    const r = await testRpcServer.get

    assert.deepEqual(invocation.req, req)
    assert.deepEqual(r, resp)
  })

  it("error", async () => {
    const message = "bla"

    const services = await startTestServer({
      test: {
        async getSomething() {
          throw new Error(message)
        },
      },
    })

    const client = await createTestClient<typeof services>()

    try {
      await client.test.getSomething()
      assert.fail()
    } catch (e: any) {
      console.log(e)
      assert.equal(e.message, message)
    }
  })

  it("timeout", async () => {
    const callTimeout = 200

    const services = await startTestServer({
      test: {
        async longOp() {
          await new Promise((r) => setTimeout(r, 2 * callTimeout))
        },
      },
    })

    const client = await createTestClient<typeof services>({
      callTimeout,
    })

    try {
      await client.test.longOp()
      assert.fail()
    } catch (e: any) {
      assert.equal(e.code, RpcErrors.Timeout)
    }
  }).timeout(1000)

  /*
  it("per-call timeout override default", async () => {
    const callTimeout = 200

    const services = await startTestServer({
      test: {
        async longOp() {
          await new Promise((r) => setTimeout(r, 2 * callTimeout))
        },
      },
    })

    const client = await createTestClient<typeof services>({
      callTimeout: 10 * 1000,
    })

    try {
      await client.test.longOp(new CallOptions({timeout: 1 * 1000})
      assert.fail()
    } catch (e) {
      assert.equal(e.code, RpcErrors.Timeout)
    }
  }).timeout(5000)

   */

  it("binds this object", async () => {
    const resp = {r: "asf"}

    const ss = {
      test: {
        async getSomething() {
          return this.method()
        },

        async method() {
          return resp
        },
      },
    }

    const services = await startTestServer(ss)

    const client = await createTestClient<typeof services>()

    const r = await client.test.getSomething()
    assert.deepEqual(r, resp)
  })

  it("binds this class", async () => {
    const resp = {r: "asf"}

    class B extends A {
      async method() {
        return resp
      }

      [x: string]: any
    }

    const services = {
      test: new B(),
    }

    await startTestServer(services)

    const client = await createTestClient<typeof services>()

    const r = await client.test.getSomething()
    assert.deepEqual(r, resp)
  })
})

abstract class A {
  async getSomething(): Promise<{r: string}> {
    return this.method()
  }

  abstract method(): Promise<{r: string}>
}