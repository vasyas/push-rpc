import {createTestClient, startTestServer} from "./testUtils.js"
import {assert} from "chai"
import {adelay} from "../src/utils/promises.js"
import {RpcContext} from "../src/index.js"

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

  it("override creation", async () => {
    let ctx = null

    const services = await startTestServer(
      {
        test: {
          async call(passedCtx?: any) {
            ctx = passedCtx
          },
        },
      },
      {
        createConnectionContext(): Promise<RpcContext> {
          return Promise.resolve({clientId: "test", newKey: "bla"})
        },
      }
    )

    const client = await createTestClient<typeof services>()

    await client.test.call()

    assert.equal(ctx!.clientId, "test")
    assert.equal(ctx!.newKey, "bla")
  })

  it("available in subscribe", async () => {
    let ctx = null

    const services = await startTestServer({
      test: {
        async call(passedCtx?: any) {
          ctx = passedCtx
        },
      },
    })

    const client = await createTestClient<typeof services>()

    await client.test.call.subscribe(() => {})

    assert.ok(ctx)
    assert.ok(ctx!.clientId)
  })

  it("available in trigger", async () => {
    let ctx = null

    const services = await startTestServer(
      {
        test: {
          async call(passedCtx?: any) {
            ctx = passedCtx
          },
        },
      },
      {
        createConnectionContext(): Promise<RpcContext> {
          return Promise.resolve({clientId: "test"})
        },
      }
    )

    const client = await createTestClient<typeof services>()

    await client.test.call.subscribe(() => {})
    assert.equal(ctx!.clientId, "test")

    ctx = null
    services.test.call.trigger()
    await adelay(20)
    assert.equal(ctx!.clientId, "test")
  })

  it("trigger has a copy", async () => {
    let ctx = null

    let count = 0

    const services = await startTestServer(
      {
        test: {
          async call(passedCtx?: any) {
            ctx = passedCtx

            if (!count) {
              ctx.modified = true
            }

            count++
          },
        },
      },
      {
        createConnectionContext(): Promise<RpcContext> {
          return Promise.resolve({clientId: "test"})
        },
      }
    )

    const client = await createTestClient<typeof services>()

    await client.test.call.subscribe(() => {})
    services.test.call.trigger()

    await adelay(20)
    assert.isNotOk(ctx!.modified)
  })

  it("modified in middleware", async () => {
    let ctx = null

    const services = await startTestServer(
      {
        test: {
          async call(passedCtx?: any) {
            ctx = passedCtx
          },
        },
      },
      {
        createConnectionContext(): Promise<RpcContext> {
          return Promise.resolve({clientId: "test", count: 0})
        },
        middleware: [
          (next, ctx: any) => {
            ctx.count++
            return next(ctx)
          },
        ],
      }
    )

    const client = await createTestClient<typeof services>()

    await client.test.call.subscribe(() => {})
    assert.equal(ctx!.count, 1)

    services.test.call.trigger()

    await adelay(20)
    assert.equal(ctx!.count, 1)
  })
})
