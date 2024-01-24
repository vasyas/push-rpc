import {createTestClient, startTestServer} from "./testUtils.js"
import {assert} from "chai"
import {IncomingMessage} from "http"
import {RpcContext} from "../src/server/index.js"

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
        createContext(): Promise<RpcContext> {
          return Promise.resolve({clientId: "test", newKey: "bla"})
        },
      }
    )

    const client = await createTestClient<typeof services>()

    await client.test.call()

    assert.ok(ctx)
    assert.equal(ctx!.clientId, "test")
    assert.equal(ctx!.newKey, "bla")
  })

  it("available in subscribe", async () => {})
  it("available in trigger", async () => {})

  it("trigger has a copy", async () => {})

  it("modified in middleware", async () => {})
})
