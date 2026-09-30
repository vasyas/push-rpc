import {assert} from "chai"
import {AddressInfo} from "node:net"
import WebSocket from "ws"
import {
  consumeServices,
  ConsumeServicesOptions,
  publishServices,
  RpcClient,
  RpcError,
} from "../src/index.js"
import {until} from "./recoveryUtils.js"

// Use the real SDK server and clients; only delay/fail the HTTP response after
// registration, so WebSocket pushes can race with a snapshot deterministically.
async function compatibilityFixture() {
  const savedWebSocket = globalThis.WebSocket
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
  const clients: RpcClient[] = []
  const snapshots = new Map([
    [1, "one"],
    [2, "two"],
  ])
  const state = {holdNext: false}
  const pending: Array<{
    snapshot: unknown
    resolve: (value: unknown) => void
    reject: (error: unknown) => void
  }> = []
  const local = {topic: async ({id}: {id: number}) => snapshots.get(id)!}
  const {server, services, httpServer} = await publishServices(local, {
    port: 0,
    host: "127.0.0.1",
    path: "/rpc",
    createServerHooks: (hooks) => ({
      ...hooks,
      subscribe: async (...args) => {
        const snapshot = await hooks.subscribe(...args)
        if (!state.holdNext) return snapshot
        state.holdNext = false
        return new Promise((resolve, reject) => pending.push({snapshot, resolve, reject}))
      },
    }),
  })
  services.topic.throttle({timeout: 0})
  const url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/rpc`

  return {
    server,
    services,
    snapshots,
    state,
    pending,
    async connect(options: Partial<ConsumeServicesOptions> = {}) {
      const notifications: unknown[] = []
      const connections = {opened: 0, closed: 0}
      const {client, remote} = await consumeServices<typeof local>(url, {
        connectOnCreate: true,
        errorDelayMaxDuration: 0,
        callTimeout: 2000,
        onConnected: () => connections.opened++,
        onDisconnected: () => connections.closed++,
        notificationsMiddleware: [
          async (_ctx, next, value) => {
            await next()
            notifications.push(value)
          },
        ],
        ...options,
      })
      clients.push(client)
      return {client, remote, notifications, connections}
    },
    async close() {
      for (const response of pending) response.resolve(response.snapshot)
      try {
        await Promise.all(clients.map((client) => client.close()))
        await server.close()
      } finally {
        globalThis.WebSocket = savedWebSocket
      }
    },
  }
}

describe("local client compatibility", () => {
  let fixture: Awaited<ReturnType<typeof compatibilityFixture>>

  beforeEach(async () => {
    fixture = await compatibilityFixture()
  })
  afterEach(async () => {
    await fixture?.close()
  })

  it("isolates legacy and policy clients, filters and consumers across one client's reconnect", async () => {
    const legacy = await fixture.connect()
    const policy = await fixture.connect({
      resubscribeConcurrency: 1,
      reconnectPolicy: {
        firstReconnectDelayMs: 0,
        minDelayMs: 5,
        maxDelayMs: 10,
        backoffFactor: 2,
        maxBackoffMs: 40,
        stableConnectionMs: 100,
        connectTimeoutMs: 500,
      },
    })
    assert.notEqual(legacy.client.clientId, policy.client.clientId)
    const first: string[] = []
    const second: string[] = []
    const otherFilter: string[] = []
    const native: string[] = []
    const firstConsumer = (value: string) => first.push(value)
    const secondConsumer = (value: string) => second.push(value)
    await legacy.remote.topic.subscribe(firstConsumer, {id: 1})
    await legacy.remote.topic.subscribe(secondConsumer, {id: 1})
    await legacy.remote.topic.subscribe((value) => otherFilter.push(value), {id: 2})
    await policy.remote.topic.subscribe((value) => native.push(value), {id: 1})
    assert.lengthOf(fixture.server._allSubscriptions(), 3)

    fixture.services.topic.trigger({id: 1}, "shared push")
    await until(
      () => [first, second, native].every((values) => values.at(-1) === "shared push"),
      "both clients and both consumers receive the matching filter",
    )
    assert.deepEqual(otherFilter, ["two"])

    fixture.snapshots.set(1, "recovered")
    policy.client.reconnect({immediate: true})
    await until(() => native.at(-1) === "recovered", "policy client recovers its snapshot")
    assert.equal(policy.connections.opened, 2)
    assert.deepEqual(legacy.connections, {opened: 1, closed: 0})
    assert.equal(second.at(-1), "shared push", "another client is not refreshed or disconnected")

    await legacy.remote.topic.unsubscribe(firstConsumer, {id: 1})
    fixture.services.topic.trigger({id: 1}, "remaining consumer")
    await until(
      () => second.at(-1) === "remaining consumer" && native.at(-1) === "remaining consumer",
      "unsubscribing one consumer preserves the other and the other client",
    )
    assert.equal(first.at(-1), "shared push")
    await legacy.remote.topic.unsubscribe(secondConsumer, {id: 1})
    fixture.services.topic.trigger({id: 1}, "other client only")
    await until(() => native.at(-1) === "other client only", "last unsubscribe is client-scoped")
    assert.equal(second.at(-1), "remaining consumer")

    await policy.client.close()
    fixture.services.topic.trigger({id: 2}, "legacy still live")
    await until(() => otherFilter.at(-1) === "legacy still live", "closing a client is isolated")
    assert.isTrue(legacy.client.isConnected())
    assert.deepEqual(legacy.connections, {opened: 1, closed: 0})
  })

  it("does not corrupt another filter's cache when a snapshot callback mutates its parameters", async () => {
    const entries = new Map<string, unknown>()
    const key = (item: string, parameters: unknown[]) => item + JSON.stringify(parameters)
    const connection = await fixture.connect({
      cache: {
        get: (item, parameters) => entries.get(key(item, parameters)),
        put: (item, parameters, value) => void entries.set(key(item, parameters), value),
      },
    })
    const other: string[] = []
    await connection.remote.topic.subscribe((value) => other.push(value), {id: 2})
    const filter = {id: 1}
    const values: string[] = []
    fixture.state.holdNext = true
    const subscribing = connection.remote.topic.subscribe((value) => {
      values.push(value)
      filter.id = 2
    }, filter)
    await until(() => fixture.pending.length === 1, "first filter snapshot held")
    fixture.services.topic.trigger({id: 1}, "queued for first filter")
    await until(
      () => connection.notifications.includes("queued for first filter"),
      "live update reaches the paused subscription before its snapshot",
    )
    fixture.pending[0].resolve("one")
    await subscribing

    assert.deepEqual(values, ["one"])
    assert.deepEqual(other, ["two"])
    assert.equal(entries.get(key("topic", [{id: 1}])), "one")
    assert.equal(entries.get(key("topic", [{id: 2}])), "two")
    fixture.services.topic.trigger({id: 2}, "second filter live")
    await until(() => other.at(-1) === "second filter live", "second filter remains usable")
    assert.equal(entries.get(key("topic", [{id: 2}])), "second filter live")
  })

  it("preserves queued and subsequent pushes when a recovery HTTP response fails", async () => {
    const connection = await fixture.connect()
    const values: string[] = []
    await connection.remote.topic.subscribe((value) => values.push(value), {id: 1})
    fixture.state.holdNext = true
    connection.client.resubscribe()
    await until(() => fixture.pending.length === 1, "recovery snapshot held")
    fixture.services.topic.trigger({id: 1}, "queued during recovery")
    await until(
      () => connection.notifications.includes("queued during recovery"),
      "live update arrives before the failing HTTP response",
    )
    assert.deepEqual(values, ["one"])
    fixture.pending[0].reject(new RpcError(503, "Snapshot response unavailable"))
    await until(() => values.at(-1) === "queued during recovery", "failure flushes live data")
    fixture.services.topic.trigger({id: 1}, "after failure")
    await until(() => values.at(-1) === "after failure", "live stream survives snapshot failure")
    assert.lengthOf(fixture.server._allSubscriptions(), 1)
    assert.isTrue(connection.client.isConnected())

    fixture.snapshots.set(1, "later snapshot")
    connection.client.resubscribe()
    await until(() => values.at(-1) === "later snapshot", "a later refresh still succeeds")
    assert.deepEqual(values, ["one", "queued during recovery", "after failure", "later snapshot"])
  })

  it("keeps the next recovery's queue when a snapshot callback synchronously resubscribes", async () => {
    const connection = await fixture.connect()
    const values: string[] = []
    await connection.remote.topic.subscribe(
      (value) => {
        values.push(value)
        if (value === "first recovery") {
          fixture.state.holdNext = true
          connection.client.resubscribe()
        }
      },
      {id: 1},
    )
    fixture.state.holdNext = true
    connection.client.resubscribe()
    await until(() => fixture.pending.length === 1, "first recovery held")
    fixture.services.topic.trigger({id: 1}, "superseded queued push")
    await until(
      () => connection.notifications.includes("superseded queued push"),
      "first recovery has a queued push",
    )
    fixture.pending[0].resolve("first recovery")
    await until(() => fixture.pending.length === 2, "consumer starts the next snapshot")
    fixture.services.topic.trigger({id: 1}, "new queued push")
    await until(
      () => connection.notifications.includes("new queued push"),
      "new push waits behind the next snapshot",
    )
    assert.deepEqual(values, ["one", "first recovery"])
    fixture.pending[1].resolve("second recovery")
    await until(() => values.at(-1) === "new queued push", "next snapshot drains its own queue")
    assert.deepEqual(values, ["one", "first recovery", "second recovery", "new queued push"])
  })
})
