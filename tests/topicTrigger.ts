describe("Topic triggers", () => {
  it("trigger filter", async () => {
    interface Item {
      key: string
    }

    const server = {
      test: {
        item: new LocalTopicImpl<Item, {key: string}>(async ({key}) => ({key}), {
          throttleTimeout: 0,
        }),
      },
    }

    await startTestServer(server)

    const {remote: client} = await createRpcClient(async () =>
      createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
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

    const {remote: client} = await createRpcClient(async () =>
      createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
    )

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

    const {remote: client} = await createRpcClient(async () =>
      createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
    )

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

    const {remote: client} = await createRpcClient(async () =>
      createNodeWebsocket(`ws://localhost:${TEST_PORT}`)
    )

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
})