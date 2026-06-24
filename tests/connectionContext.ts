import {assert} from "chai"
import WebSocket from "ws"
import {createTestClient, startTestServer, testServer, TEST_PORT} from "./testUtils.js"
import {getClientId} from "../src/index.js"
import {adelay} from "../src/utils/promises.js"

describe("getClientId", () => {
  it("reads from x-rpc-client-id header", () => {
    assert.equal(getClientId({headers: {"x-rpc-client-id": "abc"}} as any), "abc")
  })

  it("reads from sec-websocket-protocol", () => {
    assert.equal(getClientId({headers: {"sec-websocket-protocol": "xyz"}} as any), "xyz")
  })

  it("takes the first of multiple subprotocols", () => {
    assert.equal(getClientId({headers: {"sec-websocket-protocol": "p1, p2"}} as any), "p1")
  })

  it("prefers the header over the subprotocol", () => {
    assert.equal(
      getClientId({headers: {"x-rpc-client-id": "h", "sec-websocket-protocol": "p"}} as any),
      "h",
    )
  })

  it("returns undefined when neither is present", () => {
    assert.equal(getClientId({headers: {}} as any), undefined)
  })
})

describe("connection context", () => {
  it("rejects the WebSocket upgrade when createConnectionContext throws", async () => {
    await startTestServer(
      {test: {item: async () => "data"}},
      {
        async createConnectionContext(req) {
          if (req.headers.upgrade?.toLowerCase() === "websocket") {
            throw new Error("Unauthorized upgrade")
          }
          return {clientId: getClientId(req) ?? "anon"}
        },
      },
    )

    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/rpc`, "client-1")

    const outcome = await new Promise<string>((resolve) => {
      ws.on("open", () => resolve("open"))
      ws.on("error", () => resolve("error"))
      ws.on("unexpected-response", () => resolve("unexpected-response"))
    })

    assert.notEqual(outcome, "open")
    ws.terminate()
  })

  it("derives clientId from createConnectionContext for both HTTP and WS", async () => {
    // A custom derivation proves the same hook governs both transports: the HTTP
    // subscribe and the WS connection must produce the same clientId or pushes won't route.
    const services = await startTestServer(
      {test: {item: async () => "initial"}},
      {
        async createConnectionContext(req) {
          return {clientId: "fixed-" + (getClientId(req) ?? "anon")}
        },
      },
    )

    let received: unknown
    const remote = await createTestClient<typeof services>()
    await remote.test.item.subscribe((d) => {
      received = d
    })

    // allow the WS to connect and the subscription to register server-side
    await adelay(100)
    assert.equal(testServer?._allSubscriptions().length, 1)

    received = undefined
    services.test.item.trigger(undefined, "updated")
    await adelay(100)

    // push routed correctly => HTTP-subscribe clientId matched WS-connection clientId
    assert.equal(received, "updated")
  })
})
