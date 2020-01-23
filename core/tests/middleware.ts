import {composeMiddleware} from "../src"
import {Middleware} from "../src/rpc"
import {assert} from "chai"
import {createTestClient, startTestServer} from "./testUtils"

describe("middleware", () => {
  it("compose", async () => {
    const m1: Middleware = (ctx, next, params) => {
      console.log("m1", {next, params})

      return next(params + 1)
    }

    const m2: Middleware = (ctx, next, params) => {
      console.log("m2", {next, params})

      return next(params + 2)
    }

    const composed = composeMiddleware(m1, m2)

    const r = await composed(null, async p => p, 0)

    assert.equal(r, 3)
  })

  it("local", async () => {
    await startTestServer(
      {
        async getSomething(req) {
          return req
        },
      },
      {
        localMiddleware: (ctx, next, params) => next(params + 1),
      }
    )

    const client = await createTestClient(0)
    const r = await client.getSomething(1)
    assert.equal(r, 2)
  })

  it("remote", async () => {
    await startTestServer({
      async getSomething(req) {
        return req
      },
    })

    const client = await createTestClient(0, {
      remoteMiddleware: (ctx, next, params) => next(params + 1),
    })
    const r = await client.getSomething(1)
    assert.equal(r, 2)
  })
})
