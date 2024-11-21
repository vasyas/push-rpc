import {assert} from "chai"
import {Middleware, setLogger, withMiddlewares} from "../src/index.js"
import {createTestClient, startTestServer} from "./testUtils.js"
import {adelay} from "../src/utils/promises.js"

describe("middleware", () => {
  it("compose override params", async () => {
    const m1: Middleware<{}> = (ctx, next, param: any) => {
      return next(param + 1)
    }

    const m2: Middleware<{}> = (ctx, next, param: any) => {
      return next(param + 2)
    }

    const r = await withMiddlewares({}, [m1, m2], async (p, ctx) => p, 0)

    assert.equal(r, 3)
  })

  it("compose use prev params", async () => {
    const m1: Middleware<{}> = (ctx, next) => {
      return next()
    }

    const r = await withMiddlewares({}, [m1], async (p) => p, 0)

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
          (ctx: any, next) => {
            ctx.value = 1
            return next()
          },
        ],
      },
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
        (ctx, next) => {
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

  it("remote with rejection", async () => {
    const services = await startTestServer({
      async getSomething() {
        throw new Error("msg")
      },
    })

    const client = await createTestClient<typeof services>({
      middleware: [(ctx, next, params) => next(params)],
    })

    try {
      await client.getSomething()
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.message, "msg")
    }
  })

  it("notifications middlewares", async () => {
    let count = 1

    const services = await startTestServer({
      async remote(filter: {param: number}) {
        return count++
      },
    })

    const client = await createTestClient<typeof services>({
      notificationsMiddleware: [
        (ctx, next, r, params) => {
          assert.ok(ctx.itemName)
          assert.deepEqual(params, [{param: 1}])

          return next((r as number) + 1)
        },
      ],
      connectOnCreate: true,
    })

    let response
    await client.remote.subscribe(
      (r) => {
        response = r
      },
      {param: 1},
    )

    assert.equal(response, 1)
    assert.equal(count, 2)

    services.remote.trigger({param: 1})

    await adelay(20)

    assert.equal(response, 3)
  })

  it("error in notificationsMiddleware logged", async () => {
    let log = ""

    setLogger({
      error(s: unknown, ...params) {
        log += s + "\n" + params
      },
      warn: console.warn,
      debug: console.debug,
      info: console.info,
    })

    let count = 1
    let result = 0

    const services = await startTestServer({
      async remote() {
        return count++
      },
    })

    const client = await createTestClient<typeof services>({
      notificationsMiddleware: [
        () => {
          throw new Error("Test error")
        },
      ],
      connectOnCreate: true,
    })

    await client.remote.subscribe((r) => {
      result = r
    })

    services.remote.trigger()

    await adelay(20)

    assert.equal(result, 1)

    assert.include(log, "Test error")

    setLogger(console)
  })

  it("error in client request middleware propagated", async () => {
    let count = 1

    const services = await startTestServer({
      async remote() {
        return count++
      },
    })

    const client = await createTestClient<typeof services>({
      middleware: [
        () => {
          throw new Error("Error")
        },
      ],
    })

    try {
      await client.remote()
      assert.fail("Expected to fail")
    } catch (e) {}
  })

  it("error in server request middleware propagated", async () => {
    let count = 1

    const services = await startTestServer(
      {
        async remote() {
          return count++
        },
      },
      {
        middleware: [
          () => {
            throw new Error("Error")
          },
        ],
      },
    )

    const client = await createTestClient<typeof services>({})

    try {
      await client.remote()
      assert.fail("Expected to fail")
    } catch (e) {}
  })
})
