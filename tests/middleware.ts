import {assert} from "chai"
import {Middleware, withMiddlewares} from "../src/index.js"
import {createTestClient, startTestServer} from "./testUtils.js"
import {adelay} from "../src/utils/promises.js"

describe("middleware", () => {
  it("compose override params", async () => {
    const m1: Middleware = (next, param: any) => {
      return next(param + 1)
    }

    const m2: Middleware = (next, param: any) => {
      return next(param + 2)
    }

    const r = await withMiddlewares([m1, m2], async (p) => p, 0)

    assert.equal(r, 3)
  })

  it("compose use prev params", async () => {
    const m1: Middleware = (next) => {
      return next()
    }

    const r = await withMiddlewares([m1], async (p) => p, 0)

    assert.equal(r, 0)
  })

  it("local", async () => {
    let contextValue = null

    const services = await startTestServer(
      {
        item: async (ctx?: any) => {
          contextValue = ctx.value
        },
      },
      {
        middleware: [
          (next, ctx: any) => {
            ctx.value = 1
            return next()
          },
        ],
      }
    )

    const remote = await createTestClient<typeof services>()
    await remote.item()
    assert.equal(contextValue, 1)

    contextValue = null
    await remote.item.subscribe(() => {})
    assert.equal(contextValue, 1)

    contextValue = null
    services.item.trigger()
    await adelay(20)
    assert.equal(contextValue, 1)
  })

  it("remote", async () => {
    let mwInvoked = false

    const services = await startTestServer({
      item: async () => "1",
    })

    const remote = await createTestClient<typeof services>({
      middleware: [
        (next) => {
          mwInvoked = true
          return next()
        },
      ],
    })

    await remote.item()
    assert.isOk(mwInvoked)

    const sub = () => {}

    mwInvoked = false
    await remote.item.subscribe(sub)
    assert.isOk(mwInvoked)

    mwInvoked = false
    await remote.item.unsubscribe(sub)
    assert.isOk(mwInvoked)
  })

  /*




it("remote with rejection", async () => {
  await startTestServer({
    async getSomething() {
      throw new Error("msg")
    },
  })

  const client = await createTestClient(0, {
    remoteMiddleware: (ctx, next, params) => next(params),
  })

  try {
    await client.getSomething()
    assert.fail("Error expected")
  } catch (e) {
    assert.equal(e.message, "msg")
  }
})

 */
})
