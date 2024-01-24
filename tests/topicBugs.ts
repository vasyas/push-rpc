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
})
