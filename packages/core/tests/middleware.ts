import {assert} from "chai"
import {Middleware} from "../src"
import {LocalTopicImpl} from "../src/server"
import {composeMiddleware, InvocationType} from "../src/utils"
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

    const r = await composed(null, async p => p, 0, InvocationType.Call)

    assert.equal(r, 3)
  })

  it("local update context", async () => {
    let ctx
    let invocationType

    await startTestServer(
      {
        async call(req, _ctx) {
          ctx = _ctx
        },
      },
      {
        middleware: (ctx, next, params, _invocationType) => {
          invocationType = _invocationType
          ctx.attribute = 1
          return next(params)
        },
      }
    )

    const client = await createTestClient(0)
    await client.call(1)

    assert.equal(invocationType, InvocationType.Call)
    assert.equal(ctx.attribute, 1)
  })

  it("local get topic", async () => {
    let invocationType = null

    await startTestServer(
      {
        item: new LocalTopicImpl(async () => "1"),
      },
      {
        middleware: (ctx, next, params, _invocationType) => {
          invocationType = _invocationType
          return next(params)
        },
      }
    )

    const client = await createTestClient(0)
    const r = await client.item.get()
    assert.equal(r, "1")
    assert.equal(invocationType, InvocationType.Get)
  })

  /*
  it("remote get topic", async () => {
    let mwMessageType = null

    await startTestServer({
      item: new LocalTopicImpl(async () => "1"),
    })

    const client = await createTestClient(0, {
      remoteMiddleware: (ctx, next, params, messageType) => {
        mwMessageType = messageType
        return next(params)
      },
    })

    const r = await client.item.get()
    assert.equal(r, "1")
    assert.equal(mwMessageType, MessageType.Get)
  })

  it("local topic subscribe", async () => {
    let mwMessageType = null

    await startTestServer(
      {
        item: new LocalTopicImpl(async () => "1"),
      },
      {
        localMiddleware: (ctx, next, params, messageType) => {
          mwMessageType = messageType
          return next(params)
        },
      }
    )

    let r = null

    const client = await createTestClient(0)
    await client.item.subscribe(data => (r = data))

    await new Promise(r => setTimeout(r, 50))

    assert.equal(r, "1")
    assert.equal(mwMessageType, MessageType.Subscribe)
  })

  it("remote topic subscribe", async () => {
    let mwMessageType = null

    await startTestServer({
      item: new LocalTopicImpl(async () => "1"),
    })

    let r = null

    const client = await createTestClient(0, {
      remoteMiddleware: (ctx, next, params, messageType) => {
        mwMessageType = messageType
        return next(params)
      },
    })
    await client.item.subscribe(data => (r = data))

    await new Promise(r => setTimeout(r, 50))

    assert.equal(r, "1")
    assert.equal(mwMessageType, MessageType.Subscribe)
  })

  it("local param update", async () => {
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

  it("remote rejection", async () => {
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
