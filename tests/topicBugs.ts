import {assert} from "chai"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils"
import {createRpcClient, LocalTopicImpl} from "../src"
import {createNodeWebsocket} from "../../websocket/src"
import {wrapWebsocket} from "../../websocket/src/server"
import WebSocket from "ws"

describe("Topic bugs", () => {
  it("subscribe/unsubscribe bug 1", async () => {
    const item = new LocalTopicImpl(async () => {
      await new Promise((r) => setTimeout(r, 20))
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

    await new Promise((r) => setTimeout(r, 10))

    item.unsubscribeSession(session, {
      chargePointPk: "4",
      connectorPk: 6,
      sort: "transaction_pk",
      order: "desc",
      size: 1,
    })

    await new Promise((r) => setTimeout(r, 10))

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
      (r) => {
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

    await new Promise((r) => setTimeout(r, 200))

    assert.isOk(delivered)
    delivered = null
  })
})
