import {createTestClient, startTestServer, testClient} from "./testUtils.js"
import {assert} from "chai"
import {adelay} from "../src/utils/promises.js"

describe("Events", () => {
  it("subscribe event", async () => {
    const services = await startTestServer({
      test: {
        item: async (a: string) => {},
      },
    })

    let event
    services.test.item.addEventListener("subscribe", (e) => {
      event = e
    })

    const client = await createTestClient<typeof services>()

    await client.test.item.subscribe(() => {}, "a")

    assert.deepEqual(event, {
      itemName: "test/item",
      parameters: ["a"],
      clientId: testClient!.clientId,
      context: {
        clientId: testClient!.clientId,
      },
    })
  })
  it("unsubscribe event", async () => {
    const services = await startTestServer({
      test: {
        item: async (a: string) => {},
      },
    })

    let event
    services.test.item.addEventListener("unsubscribe", (e) => {
      event = e
    })

    const client = await createTestClient<typeof services>()

    const listener = () => {}
    await client.test.item.subscribe(listener, "a")
    await client.test.item.unsubscribe(listener, "a")

    assert.deepEqual(event, {
      itemName: "test/item",
      parameters: ["a"],
      clientId: testClient!.clientId,
    })
  })
  it("unsubscribe on disconnect WS", async () => {
    const services = await startTestServer({
      test: {
        item: async (a: string) => {},
      },
    })

    let event
    services.test.item.addEventListener("unsubscribe", (e) => {
      event = e
    })

    const client = await createTestClient<typeof services>()

    const listener = () => {}
    await client.test.item.subscribe(listener, "a")

    await testClient!.close()

    await adelay(100)

    assert.deepEqual(event, {
      itemName: "test/item",
      parameters: ["a"],
      clientId: testClient!.clientId,
    })
  })
})
