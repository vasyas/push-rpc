import {assert} from "chai"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils"
import {createRpcClient, LocalTopicImpl} from "../src"
import {createNodeWebsocket} from "../../websocket/src"
import {wrapWebsocket} from "../../websocket/src/server"
import WebSocket from "ws"

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

    await client.remote.item.subscribe(() => {}, {}, "1")
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.subscribe(() => {}, {}, "2")
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    // assert.equal(2, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({}, "1")
    await new Promise(r => setTimeout(r, 100))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({}, "2")
    await new Promise(r => setTimeout(r, 100))
    assert.equal(0, Object.keys(services.item["subscriptions"]).length)
  })

  it("unsubscribe all", async () => {
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

    await client.remote.item.subscribe(() => {}, {}, "1")
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.subscribe(() => {}, {}, "2")
    await new Promise(r => setTimeout(r, 20))
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

    await client.remote.item.subscribe(() => {}, {}, "1")
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.subscribe(() => {}, {})
    await new Promise(r => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({}, "1")
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

  it("double subscribe unsubscribe bug", async () => {
    let delivered = null

    const server = {
      test: {
        item: new LocalTopicImpl(async () => "ok"),
      },
    }
    await startTestServer(server)

    const client = await createTestClient()

    await client.test.item.subscribe(
      r => {
        console.log("Got sub 1")
        delivered = r
      },
      {},
      "1"
    )
    await client.test.item.subscribe(
      () => {
        console.log("Got sub 2")
      },
      {},
      "2"
    )

    assert.isOk(delivered)
    delivered = null

    await client.test.item.unsubscribe({}, "2")
    console.log("Unsubscribe")

    server.test.item.trigger()
    console.log("Trigger")

    await new Promise(r => setTimeout(r, 200))

    assert.isOk(delivered)
    delivered = null
  })
})
