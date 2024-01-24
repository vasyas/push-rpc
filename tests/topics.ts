import {assert} from "chai"
import {createTestClient, startTestServer, testClient, testServer} from "./testUtils.js"
import {adelay} from "../src/utils/promises.js"

describe("Topics", () => {
  it("subscribe delivers data", async () => {
    const item = {r: "1"}

    const remote = await startTestServer({
      test: {
        item: async () => item,
      },
    })

    const client = await createTestClient<typeof remote>()

    let receivedItem

    await client.test.item.subscribe(() => {
      receivedItem = item
    })

    await adelay(50)
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
    await adelay(20)

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
    await remote.test.item.subscribe((item) => {
      item1 = item
    })

    await adelay(50)
    assert.deepEqual(item1, item)

    let item2
    await remote.test.item.subscribe((item) => {
      item2 = item
    })

    await adelay(50)
    assert.deepEqual(item2, item)

    // trigger sends item
    item.r = "2"
    services.test.item.trigger()
    await adelay(50)
    assert.deepEqual(item1, item)
    assert.deepEqual(item2, item)

    // a single subscription present on server
    assert.equal(testServer?._subscriptions().size, 1)
    assert.equal(testServer?._subscriptions().get("test/item")?.byFilter.size, 1)
    assert.equal(
      testServer?._subscriptions().get("test/item")?.byFilter.get("null").subscribedClients.length,
      1
    )
  })

  it("concurrent subscribe cache", async () => {
    const item = {r: "1"}
    let supplied = 0

    const server = {
      test: {
        item: async () => {
          await adelay(1)
          supplied++
          return item
        },
      },
    }

    await startTestServer(server)

    const client = await createTestClient<typeof server>()

    let item1
    client.test.item.subscribe((item) => {
      item1 = item
    })

    let item2
    client.test.item.subscribe((item) => {
      item2 = item
    })

    await adelay(50)
    assert.deepEqual(item1, item)
    assert.deepEqual(item2, item)

    assert.equal(supplied, 1)
  })

  it("subscribe use client cached value", async () => {
    const item = {r: "1"}

    const server = {
      test: {
        item: async () => item,
      },
    }

    await startTestServer(server)

    const client = await createTestClient<typeof server>()

    let item1
    await client.test.item.subscribe((item) => {
      item1 = item
    })

    await adelay(50)
    assert.deepEqual(item1, item)

    item.r = "2"

    let item2
    client.test.item.subscribe((item) => {
      item2 = item
    })

    // cached version should be delivered
    assert.deepEqual(item2, {r: "1"})

    await adelay(50)

    // and a new version after some time
    assert.deepEqual(item2, item)
  })

  it("unsubscribe topics on disconnect", async () => {
    const item = {r: "1"}

    const server = {
      testUnsub: {
        item: async () => item,
      },
    }

    await startTestServer(server)

    const remote = await createTestClient<typeof server>()

    await remote.testUnsub.item.subscribe(() => {})

    assert.equal(1, testServer?._subscriptions().size)

    await testClient!.close()

    await new Promise((r) => setTimeout(r, 50))

    // client's subscriptions are not removed intentionally not to lose existing handlers
    assert.equal(testClient?._allSubscriptions().length, 1)

    assert.equal(0, testServer?._subscriptions().size)
  })

  it("resubscribe on reconnect", async () => {
    const item = {r: "1"}

    const services = await startTestServer({
      test: {
        item: async () => item,
      },
    })

    const remote = await createTestClient<typeof services>()

    let receivedItem

    await remote.test.item.subscribe((item) => {
      receivedItem = item
    })

    // first notification right after subscription
    await adelay(50)
    assert.deepEqual(receivedItem, item)

    // trigger sends item
    item.r = "2"
    services.test.item.trigger()
    await adelay(50)
    assert.deepEqual(receivedItem, item)

    console.log("before  close")

    // disconnect & resubscribe
    testClient?._webSocket()?.close()
    await adelay(50)

    console.log("before trigger")

    // session should be re-subscribed, trigger should continue to send items
    item.r = "3"
    services.test.item.trigger()
    await adelay(50)
    assert.deepEqual(receivedItem, item)
  })

  /*
  it("double subscribe leaves session referenced on unsubscribe", async () => {
    const services = await startTestServer({
      item: async () => 1,
    })

    const remote = await createTestClient<typeof services>()

    await remote.item.subscribe(() => {}, {}, "1")
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await remote.item.subscribe(() => {}, {}, "2")
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    // assert.equal(2, Object.values(services.item["subscriptions"])[0].sessions.length)

    await remote.item.unsubscribe({}, "1")
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(1, Object.keys(services.item["subscriptions"]).length)
    assert.equal(1, Object.values(services.item["subscriptions"])[0].sessions.length)

    await client.remote.item.unsubscribe({}, "2")
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(0, Object.keys(services.item["subscriptions"]).length)
  })
  
   */
})
