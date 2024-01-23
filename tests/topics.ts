import {assert} from "chai"
import {createTestClient, startTestServer, testServer} from "./testUtils.js"

describe("Topics", () => {
  it("subscribe delivers data", async () => {
    const item = {r: "1"}

    const remote = await startTestServer({
      test: {
        item: async () => item
      },
    })

    const client = await createTestClient<typeof remote>()

    let receivedItem

    await client.test.item.subscribe(() => {
      receivedItem = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(receivedItem, item)
  })

  it("error in supplier breaks subscribe", async () => {
    const remote = await startTestServer({
      item: async () => {
        throw new Error("AA")
      },
    })

    const client = await createTestClient<typeof remote>()

    try {
      await client.item.subscribe(() => {})
      assert.fail("Error expected")
    } catch (e: any) {
      assert.equal(e.message, "AA")
    }
  })

  it("exception during subscribe do not create subscription", async () => {
    const services = {
      item: async () => {
        throw new Error()
      },
    }

    await startTestServer(services)

    const remote = await createTestClient<typeof services>()

    remote.item
      .subscribe(() => {})
      .catch((e: any) => {
        // ignored
      })

    // pause the socket so that the server doesn't get the unsubscribe message
    await new Promise(r => setTimeout(r, 20))

    assert.equal(0, testServer?._subscriptions().size)
  })

  it("2nd subscribe", async () => {
    const item = {r: "1"}

    const services = await startTestServer({
      test: {
        item: async () => item,
      },
    })

    const remote = await createTestClient<typeof services>()

    let item1
    await remote.test.item.subscribe(item => {
      item1 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)

    let item2
    await remote.test.item.subscribe(item => {
      item2 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item2, item)

    // trigger sends item
    item.r = "2"
    services.test.item.trigger()
    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)
    assert.deepEqual(item2, item)
  })

  it("concurrent subscribe cache", async () => {
    const item = {r: "1"}
    let supplied = 0

    const server = {
      test: {
        item: async () => {
          supplied++
          return item
        },
      },
    }

    await startTestServer(server)

    const client = await createTestClient<typeof server>()

    let item1
    client.test.item.subscribe(item => {
      item1 = item
    })

    let item2
    client.test.item.subscribe(item => {
      item2 = item
    })

    await new Promise(resolve => setTimeout(resolve, 50))
    assert.deepEqual(item1, item)
    assert.deepEqual(item2, item)

    assert.equal(supplied, 1)
  })

  it("subscribe use cached value", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: async () => item,
      },
    }

    await startTestServer(server)

    const client = await createTestClient<typeof server>()

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
  to be implemented after connection tracking

  it("unsubscribe topics on disconnect", async () => {
    const item = {r: "1"}

    const server = {
      testUnsub: {
        item: async () => item,
      },
    }

    await startTestServer(server)

    const client = await createRpcClient(
      async () => createNodeWebsocket(`ws://localhost:${TEST_PORT}`),
      {reconnect: false}
    )

    await client.remote.testUnsub.item.subscribe(() => {})

    assert.equal(1, testServer?._subscriptions().size)

    client.disconnect()

    await new Promise(r => setTimeout(r, 50))

    // client's RemoteTopicImpl is not unsubscribed intentionally not to loose existing handlers
    assert.equal(Object.keys(client.remote.testUnsub.item.getConsumers()).length, 1)

    assert.equal(0, testServer?._subscriptions().size)
  })

  it("resubscribe on reconnect", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: new LocalTopicImpl(async () => item),
      },
    }

    await startTestServer(server)

    let socket

    const client = await createRpcClient(
      () => {
        socket = createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
        return socket
      },
      {reconnect: true}
    )

    let receivedItem

    await client.remote.test.item.subscribe(item => {
      receivedItem = item
    })

    // first notification right after subscription
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

    client.disconnect()
  })
   */
})
