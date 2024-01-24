import {createTestClient, startTestServer} from "./testUtils.js"
import {adelay} from "../src/utils/promises.js"
import {assert} from "chai"

describe("Subscription triggers", () => {
  it("trigger filter", async () => {
    interface Item {
      key: string
    }

    const services = await startTestServer({
      test: {
        async item({key}: Item): Promise<Item> {
          return {key}
        },
      },
    })

    const remote = await createTestClient<typeof services>()

    let item1
    let item2

    const sub1 = (item: Item) => (item1 = item)
    const sub2 = (item: Item) => (item2 = item)

    await remote.test.item.subscribe(sub1, {key: "1"})
    await remote.test.item.subscribe(sub2, {key: "2"})

    // first notificaiton right after subscription, clear items
    await adelay(20)

    // trigger sends 1st item, but not second
    item1 = null
    item2 = null

    services.test.item.trigger({key: "1"})
    await adelay(20)
    assert.deepEqual(item1, {key: "1"})
    assert.isNull(item2)

    // null trigger sends all items
    item1 = null
    item2 = null

    services.test.item.trigger()
    await adelay(20)
    assert.deepEqual(item1, {key: "1"})
    assert.deepEqual(item2, {key: "2"})
  })

  it("trigger throttling", async () => {
    const throttleTimeout = 400

    // configure throttleTimeout,

    const services = await startTestServer({
      test: {
        item: async () => "result",
      },
    })

    const remote = await createTestClient<typeof services>()

    let count = 0
    let item = null

    await remote.test.item.subscribe((i) => {
      count++
      item = i
    })

    await adelay(50)
    assert.equal(count, 1)
    assert.equal(item, "result")

    services.test.item.trigger(undefined, "1st")
    services.test.item.trigger(undefined, "2nd") // throttled
    await adelay(50)
    assert.equal(count, 2)
    assert.equal(item, "1st")

    services.test.item.trigger(undefined, "3rd") // throttled
    services.test.item.trigger(undefined, "4th") // delivered on trailing edge

    await adelay(50)
    assert.equal(count, 2)

    await adelay(throttleTimeout + 50)
    assert.equal(count, 3)
    assert.equal(item, "4th")
  })

  /*
it("throttling reducer", async () => {
  const throttleTimeout = 400

  const server = {
    test: {
      item: new LocalTopicImpl(async () => [], {throttleTimeout, throttleReducer: groupReducer}),
    },
  }

  await startTestServer(server)

  const {remote: client} = await createRpcClient(async () =>
    createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
  )

  let item = null

  await client.test.item.subscribe((i) => {
    console.log(i.item)
    item = i
  })

  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.deepEqual(item, [])

  server.test.item.trigger({}, [1])
  server.test.item.trigger({}, [2]) // throttled
  server.test.item.trigger({}, [3]) // throttled
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.deepEqual(item, [1])

  await new Promise((resolve) => setTimeout(resolve, throttleTimeout))
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

  const {remote: client} = await createRpcClient(async () =>
    createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
  )

  let item = null

  await client.test.item.subscribe((i) => {
    item = i
  })

  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.deepEqual(item, "n/a")

  server.test.item.trigger({}, 1)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.deepEqual(item, "a")
})
 */
})
