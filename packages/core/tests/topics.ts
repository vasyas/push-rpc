import {assert} from "chai"
import {LocalTopicImpl} from "../src"
import {adelay, createTestClient, startTestServer} from "./testUtils"

describe.only("Topics", () => {
  it("error in supplier breaks subscribe", async () => {
    await startTestServer({
      item: new LocalTopicImpl(async () => {
        throw new Error("AA")
      }),
    })

    const client = await createTestClient(0)

    try {
      await client.item.subscribe(() => {})
      assert.fail("Error expected")
    } catch (e) {
      assert.equal(e.message, "AA")
    }
  })

  it("get", async () => {
    const item = {r: "asf"}

    await startTestServer({
      test: {
        item: new LocalTopicImpl(async () => item),
      },
    })

    const client = await createTestClient()

    const r = await client.test.item.get({})

    assert.deepEqual(r, item)
  })

  /*
  it("resubscribe", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl(async () => item),
      },
    }

    await startTestServer(server)

    let socket

    const {remote: client} = await createRpcClient(
      1,
      () => {
        socket = createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
        return socket
      },
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

    // disconnect & resubscribe
    socket.disconnect()
    await new Promise(resolve => setTimeout(resolve, 50))

    // session should be re-subscribed, trigger should continue to send items
    item.r = "3"
    server.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)
  })

   */

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

    const client = await createTestClient()

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

    await adelay(50)

    // first notification right after subscription, need clear items
    item1 = null
    item2 = null

    // trigger sends 1st item, but not second
    server.test.item.trigger({key: "1"})
    await adelay(50)
    assert.deepEqual(item1, {key: "1"})
    assert.isNull(item2)

    // null trigger sends all items
    item1 = null
    item2 = null

    server.test.item.trigger(null)
    await adelay(50)
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

    const client = await createTestClient()

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

  it("subscribe use cached value", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl<typeof item, {}>(async () => item),
      },
    }

    await startTestServer(server)
    const client = await createTestClient()

    let item1
    await client.test.item.subscribe(item => {
      item1 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)

    item.r = "2"

    let item2
    client.test.item.subscribe(item => {
      item2 = item
    })

    // cached version should be delivered
    assert.deepEqual(item2, {r: "1"})

    await new Promise(resolve => setTimeout(resolve, 50))

    // and a new version after some time
    assert.deepEqual(item2, item)
  })

  /*

  it("trigger throttling", async () => {
    const throttleTimeout = 400

    const server = {
      test: {
        item: new LocalTopicImpl(async () => "result", {
          throttleTimeout,
        }),
      },
    }

    await startTestServer(server)

    const client = await createTestClient()

    let count = 0
    let item = null

    await client.test.item.subscribe(i => {
      count++
      item = i
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(count, 1)
    assert.equal(item, "result")

    server.test.item.trigger({}, "1st")
    server.test.item.trigger({}, "2nd") // throttled
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(count, 2)
    assert.equal(item, "1st")

    server.test.item.trigger({}, "3rd") // throttled
    server.test.item.trigger({}, "4th") // delivered on trailing edge

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.equal(count, 2)

    await new Promise(resolve => setTimeout(resolve, throttleTimeout + 50))
    assert.equal(count, 3)
    assert.equal(item, "4th")
  })

  it("throttling reducer", async () => {
    const throttleTimeout = 400

    const server = {
      test: {
        item: new LocalTopicImpl(async () => [], {throttleTimeout, throttleReducer: groupReducer}),
      },
    }

    await startTestServer(server)
    const client = await createTestClient()

    let item = null

    await client.test.item.subscribe(i => {
      console.log(i.item)
      item = i
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item, [])

    server.test.item.trigger({}, [1])
    server.test.item.trigger({}, [2]) // throttled
    server.test.item.trigger({}, [3]) // throttled
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item, [1])

    await new Promise(resolve => setTimeout(resolve, throttleTimeout))
    assert.deepEqual(item, [2, 3]) // trailing edge
  })

  it("trigger mapper", async () => {
    const map = {
      1: "a",
      2: "b",
      3: "c",
    }

    const server = {
      test: {
        item: new LocalTopicImpl(async () => "n/a", {
          triggerMapper: (key: number) => map[key],
        }),
      },
    }

    await startTestServer(server)
    const client = await createTestClient()

    let item = null

    await client.test.item.subscribe(i => {
      item = i
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item, "n/a")

    server.test.item.trigger({}, 1)
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item, "a")
  })

   */
})
