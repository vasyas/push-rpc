import {assert} from "chai"
import {startTestServer, TEST_PORT} from "./testUtils"
import {createRpcClient, LocalTopicImpl} from "../src"
import {createNodeWebsocket} from "../../websocket/src"

describe("Topic bugs", () => {
  it("double subscribe leaves session referenced on unsubscribe", async () => {
    const services = {
      item: new LocalTopicImpl(async () => {
        return 1
      }),
    }

    await startTestServer(services)

    const client = await createRpcClient(
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {}
    )

    await client.remote.item.subscribe(() => {}, {})
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.subscribe(() => {}, {})
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(2, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({})
    await new Promise(r => setTimeout(r, 100))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({})
    await new Promise(r => setTimeout(r, 100))
    assert.equal(0, Object.keys(services.item["subscriptions"]).length)
  })

  it("double subscribe leaves session referenced on disconnect", async () => {
    const services = {
      item: new LocalTopicImpl(async () => {
        return 1
      }),
    }

    await startTestServer(services)

    const client = await createRpcClient(
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {}
    )

    await client.remote.item.subscribe(() => {}, {})
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.subscribe(() => {}, {})
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(2, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({})
    await new Promise(r => setTimeout(r, 100))

    await client.disconnect()
    await new Promise(r => setTimeout(r, 100))

    assert.equal(0, Object.keys(services.item["subscriptions"]).length)
  })

  it("subscribe/unsubscribe bug 1", async () => {
    const item = new LocalTopicImpl(async () => {
      await new Promise(r => setTimeout(r, 20))
      return 1
    })

    const session: any = {
      getConnectionContext() {
        return {
          remoteId: "2",
        }
      },
    }
    const ctx: any = {}

    item.subscribeSession(
      session,
      {
        chargePointPk: "4",
        connectorPk: 6,
        sort: "transaction_pk",
        order: "desc",
        size: 1,
      },
      "1",
      ctx
    )

    await new Promise(r => setTimeout(r, 10))

    item.unsubscribeSession(session, {
      chargePointPk: "4",
      connectorPk: 6,
      sort: "transaction_pk",
      order: "desc",
      size: 1,
    })

    await new Promise(r => setTimeout(r, 10))

    assert.equal(0, Object.keys(item["subscriptions"]).length)
  })
})
