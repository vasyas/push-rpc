import {assert} from "chai"
import {adelay} from "../src/utils/promises.js"
import {setTestCloseTimeout} from "../src/client/WebSocketConnection.js"
import {RecoveryFixture, recoveryFixture, until} from "./recoveryUtils.js"

describe("explicit reconnect", () => {
  let fixture: RecoveryFixture

  afterEach(async () => {
    await fixture?.close()
    setTestCloseTimeout(null)
  })

  it("abandons a stuck close handshake and restores snapshots and subsequent pushes", async () => {
    fixture = await recoveryFixture()
    const {client, remote, state, clientSockets, connections, publish} = fixture
    const values: string[] = []
    await client.connect()
    await remote.topic.subscribe((value) => values.push(value), 1)
    const clientId = client.clientId
    const oldSocket = clientSockets[0]
    oldSocket.hangClose = true
    state.value = "refreshed"

    client.reconnect()
    await until(() => connections.length === 2 && values.includes("refreshed"), "reconnected")
    assert.equal(client.clientId, clientId)
    assert.lengthOf(client._allSubscriptions(), 1)
    assert.notStrictEqual<object | null>(client._webSocket(), oldSocket)
    publish("live")
    await until(() => values.at(-1) === "live", "original consumer receives the next push")

    // Abandoned native sockets can still deliver callbacks after a replacement opens.
    oldSocket.emit("open")
    oldSocket.emit("message", Buffer.from(JSON.stringify(["topic", "stale", 1])), false)
    oldSocket.emit("error", new Error("late error"))
    oldSocket.emit("close", 1006, Buffer.alloc(0))
    await adelay(20)
    assert.equal(values.at(-1), "live")
    assert.notStrictEqual<object | null>(client._webSocket(), oldSocket)
    publish("still-live")
    await until(() => values.at(-1) === "still-live", "late callbacks preserve the replacement")
  })

  it("replaces an unfinished opening handshake and resolves the original connect promise", async () => {
    fixture = await recoveryFixture()
    fixture.state.holdUpgrade = true
    const connected = fixture.client.connect()
    await until(() => fixture.state.upgrades === 1, "first handshake reached the peer")
    fixture.state.holdUpgrade = false
    fixture.client.reconnect()
    await until(() => fixture.connections.length === 1, "replacement connection opened")
    await connected
    assert.equal(fixture.state.upgrades, 2)
  })

  it("wakes a reconnect loop sleeping in its retry delay", async () => {
    fixture = await recoveryFixture({reconnectDelay: 5000})
    await fixture.client.connect()
    fixture.connections[0].terminate()
    await until(() => !fixture.client.isConnected(), "connection lost")
    fixture.client.reconnect()
    await until(() => fixture.connections.length === 2, "reconnected without the 5s delay")
  })

  it("cannot revive an explicitly closed client", async () => {
    fixture = await recoveryFixture()
    await fixture.client.connect()
    await fixture.client.close()
    fixture.client.reconnect()
    await fixture.client.connect()
    await adelay(30)
    assert.isNull(fixture.client._webSocket())
    assert.lengthOf(fixture.connections, 1)
  })

  it("does not open a connection when subscriptions are disabled", async () => {
    fixture = await recoveryFixture({subscriptions: false})
    fixture.client.reconnect()
    await adelay(30)
    assert.lengthOf(fixture.connections, 0)
  })

  it("can permanently close a pending handshake without allowing a late open", async () => {
    fixture = await recoveryFixture()
    setTestCloseTimeout(20)
    fixture.state.holdUpgrade = true
    void fixture.client.connect()
    await until(() => fixture.state.upgrades === 1, "handshake pending")
    await fixture.client.close()
    fixture.clientSockets[0].emit("open")
    await adelay(30)
    assert.isFalse(fixture.client.isConnected())
    assert.equal(fixture.state.upgrades, 1)
  })

  it("eventually abandons a hung graceful close", async () => {
    fixture = await recoveryFixture()
    setTestCloseTimeout(20)
    await fixture.client.connect()
    fixture.clientSockets[0].hangClose = true
    await fixture.client.close()
    assert.isFalse(fixture.client.isConnected())
  })

  it("recovers from a heartbeat timeout even when native close never completes", async () => {
    fixture = await recoveryFixture({pingInterval: 30})
    setTestCloseTimeout(20)
    await fixture.client.connect()
    fixture.clientSockets[0].hangClose = true
    await until(() => fixture.connections.length === 2, "heartbeat close fallback recovered")
  })
})
