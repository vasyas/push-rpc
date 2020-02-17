import {assert} from "chai"
import * as WebSocket from "ws"
import {createRpcClient, LocalTopicImpl} from "../src"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils"
import {createWebsocket} from "../../websocket/src/server"

describe("Topics", () => {
  it("get", async () => {
    const item = {r: "asf"}

    await startTestServer({
      test: {
        item: new LocalTopicImpl<{}, any>(async () => item),
      },
    })

    const client = await createTestClient()

    const r = await client.test.item.get({})

    assert.deepEqual(r, item)
  })

  it("resubscribe", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl<typeof item, {}>(async () => item),
      },
    }

    await startTestServer(server)

    const {remote: client, disconnect} = await createRpcClient(
      1,
      () => createWebsocket(`ws://localhost:${TEST_PORT}`),
      {reconnect: true}
    )

    let receivedItem

    await client.test.item.subscribe(item => {
      receivedItem = item
    })

    // first notificaiton right after subscription
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)

    // trigger sends item
    item.r = "2"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)

    // resubscribe
    disconnect()
    await new Promise(resolve => setTimeout(resolve, 50))

    // session should be re-subscribed, trigger should continue to send items
    item.r = "3"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)
  })

  it("trigger filter", async () => {
    interface Item {
      key: string
    }

    const server = {
      test: {
        item: new LocalTopicImpl<Item, {key: string}>(async ({key}) => ({key})),
      },
    }

    await startTestServer(server)

    const {remote: client} = await createRpcClient(
      1,
      () => createWebsocket(`ws://localhost:${TEST_PORT}`),
      {reconnect: true}
    )

    let item1
    let item2

    await client.test.item.subscribe(
      item => {
        item1 = item
      },
      {key: "1"}
    )

    await client.test.item.subscribe(
      item => {
        item2 = item
      },
      {key: "2"}
    )

    // first notificaiton right after subscription, clear items
    await new Promise(resolve => setTimeout(resolve, 50))

    // trigger sends 1st item, but not second
    item1 = null
    item2 = null

    server.test.item.trigger({key: "1"})
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, {key: "1"})
    assert.isNull(item2)

    // null trigger sends all items
    item1 = null
    item2 = null

    server.test.item.trigger(null)
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, {key: "1"})
    assert.deepEqual(item2, {key: "2"})
  })

  it("2nd subscribe", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl<typeof item, {}>(async () => item),
      },
    }

    await startTestServer(server)

    const {remote: client} = await createRpcClient(
      1,
      () => createWebsocket(`ws://localhost:${TEST_PORT}`),
      {reconnect: true}
    )

    let item1
    await client.test.item.subscribe(item => {
      item1 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)

    let item2
    await client.test.item.subscribe(item => {
      item2 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item2, item)

    // trigger sends item
    item.r = "2"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)
    assert.deepEqual(item2, item)
  })
})
