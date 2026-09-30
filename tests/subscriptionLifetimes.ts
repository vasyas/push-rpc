import {assert} from "chai"
import {createServer, ServerResponse} from "node:http"
import {AddressInfo, Socket} from "node:net"
import WebSocket, {WebSocketServer} from "ws"
import {consumeServices, ConsumeServicesOptions} from "../src/client/index.js"
import {CallOptions, InvocationType, RpcErrors} from "../src/rpc.js"
import {adelay} from "../src/utils/promises.js"
import {until} from "./recoveryUtils.js"

type WireRequest = {
  method: string
  parameters: unknown[]
  epoch: string | undefined
  lifetime: string | undefined
  response: ServerResponse
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return {promise, resolve}
}

// A real loopback peer observes SDK wire identity; production Keeper accounting
// is covered by billing's registry/integration tests rather than duplicated here.
async function lifetimeFixture(options: Partial<ConsumeServicesOptions> = {}) {
  const savedWebSocket = globalThis.WebSocket
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
  const sockets = new Set<Socket>()
  const connections: Array<{ws: WebSocket; epoch: string | null; version: string | null}> = []
  const requests: WireRequest[] = []
  const heldUpgrades: Array<() => void> = []
  const pending: WireRequest[] = []
  const state = {
    acknowledge: true,
    holdUpgrade: false,
    holdNext: false,
    slowNext: false,
    status: 200,
    errorHeader: true,
  }
  const wss = new WebSocketServer({noServer: true})
  function reply(request: WireRequest, value = "snapshot") {
    request.response.end(JSON.stringify(value))
  }
  const server = createServer(async (req, res) => {
    let body = ""
    for await (const chunk of req) body += chunk
    const request: WireRequest = {
      method: req.method!,
      parameters: JSON.parse(body || "[]"),
      epoch: req.headers["x-rpc-subscription-epoch"] as string | undefined,
      lifetime: req.headers["x-rpc-subscription-lifetime"] as string | undefined,
      response: res,
    }
    requests.push(request)
    if (state.acknowledge) res.setHeader("x-rpc-subscription-version", "1")
    res.setHeader("Content-Type", "application/json")
    res.statusCode = state.status
    if (state.status !== 200 && state.errorHeader) res.setHeader("x-error", "Unavailable")
    state.status = 200
    if (state.holdNext || state.slowNext) {
      if (state.slowNext) {
        res.flushHeaders()
        res.write('"')
      }
      state.holdNext = state.slowNext = false
      pending.push(request)
      return
    }
    reply(request)
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  server.on("upgrade", (req, socket, head) => {
    const upgrade = () =>
      wss.handleUpgrade(req, socket, head, (ws) => {
        const url = new URL(req.url!, "http://127.0.0.1")
        connections.push({
          ws,
          epoch: url.searchParams.get("rpcSubscriptionEpoch"),
          version: url.searchParams.get("rpcSubscriptionVersion"),
        })
      })
    if (state.holdUpgrade) heldUpgrades.push(upgrade)
    else upgrade()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const {client, remote} = await consumeServices<{
    topic: (filter: {id: number}) => Promise<string>
  }>(`http://127.0.0.1:${(server.address() as AddressInfo).port}/rpc`, {
    subscriptionLifetimes: true,
    resubscribeConcurrency: 1,
    callTimeout: 1500,
    errorDelayMaxDuration: 0,
    ...options,
  })
  return {
    client,
    remote,
    requests,
    connections,
    pending,
    heldUpgrades,
    state,
    reply,
    async close() {
      const closing = client.close()
      for (const socket of sockets) socket.destroy()
      await closing
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      await new Promise<void>((resolve) => server.close(() => resolve()))
      globalThis.WebSocket = savedWebSocket
    },
  }
}

function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("Expected rejection")
    },
    (error: Error & {code?: number}) => error,
  )
}

describe("opt-in subscription lifetimes", () => {
  let fixture: Awaited<ReturnType<typeof lifetimeFixture>>
  afterEach(async () => {
    await fixture?.close()
  })

  it("leaves legacy URLs, headers and unsupported-server behavior unchanged", async () => {
    fixture = await lifetimeFixture({subscriptionLifetimes: false})
    fixture.state.acknowledge = false
    await fixture.client.connect()
    const consumer = () => {}
    await fixture.remote.topic.subscribe(consumer, {id: 1})
    await fixture.remote.topic.unsubscribe(consumer, {id: 1})
    assert.isNull(fixture.connections[0].epoch)
    assert.isNull(fixture.connections[0].version)
    assert.isTrue(fixture.requests.every((r) => r.epoch === undefined && r.lifetime === undefined))
    assert.isTrue(fixture.client.isConnected())
  })

  it("uses one initial PUT and keeps one lifetime through consumers, refresh and final PATCH", async () => {
    fixture = await lifetimeFixture()
    const first = () => {}
    const second = () => {}
    await fixture.remote.topic.subscribe(first, {id: 1})
    assert.lengthOf(
      fixture.requests,
      1,
      "first OPEN supersedes the initial request without duplicating PUT",
    )
    const original = fixture.requests[0]
    assert.equal(original.epoch, fixture.connections[0].epoch)
    assert.equal(fixture.connections[0].version, "1")
    assert.isAbove(Number(original.lifetime), 0)
    await fixture.remote.topic.subscribe(second, {id: 1})
    fixture.client.resubscribe()
    await until(() => fixture.requests.length === 3, "refresh sent")
    assert.isTrue(fixture.requests.every((r) => r.lifetime === original.lifetime))
    await fixture.remote.topic.unsubscribe(first, {id: 1})
    assert.lengthOf(fixture.requests, 3, "removing one consumer sends no PATCH")
    await fixture.remote.topic.unsubscribe(second, {id: 1})
    assert.equal(fixture.requests[3].method, "PATCH")
    assert.equal(fixture.requests[3].lifetime, original.lifetime)
    await fixture.remote.topic.subscribe(first, {id: 1})
    assert.isAbove(Number(fixture.requests[4].lifetime), Number(original.lifetime))
  })

  it("captures an old PATCH before async headers and never rebinds it to a new epoch/lifetime", async () => {
    const headers = deferred<Record<string, string>>()
    let holdHeaders = false
    fixture = await lifetimeFixture({
      getHeaders: async () => {
        if (holdHeaders) {
          holdHeaders = false
          return headers.promise
        }
        return {}
      },
    })
    const consumer = () => {}
    await fixture.remote.topic.subscribe(consumer, {id: 1})
    const first = fixture.requests[0]
    holdHeaders = true
    const removing = fixture.remote.topic.unsubscribe(consumer, {id: 1})
    fixture.client.reconnect({immediate: true})
    await until(() => fixture.connections.length === 2, "replacement socket opens")
    await fixture.remote.topic.subscribe(consumer, {id: 1})
    const replacement = fixture.requests[1]
    assert.notEqual(replacement.epoch, first.epoch)
    assert.isAbove(Number(replacement.lifetime), Number(first.lifetime))
    headers.resolve({})
    await removing
    const late = fixture.requests[2]
    assert.equal(late.method, "PATCH")
    assert.equal(late.epoch, first.epoch)
    assert.equal(late.lifetime, first.lifetime)
  })

  it("keeps the lifetime across reconnect while fencing a late old HTTP snapshot", async () => {
    // One slot remains occupied by the deliberately held old HTTP request.
    fixture = await lifetimeFixture({resubscribeConcurrency: 2})
    const values: string[] = []
    await fixture.remote.topic.subscribe((v) => values.push(v), {id: 1})
    fixture.state.holdNext = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 1, "old snapshot held")
    const old = fixture.pending[0]
    fixture.client.reconnect({immediate: true})
    await until(() => fixture.requests.length === 3, "replacement snapshot sent")
    assert.equal(fixture.requests[2].lifetime, old.lifetime)
    assert.notEqual(fixture.requests[2].epoch, old.epoch)
    await until(() => values.length === 2, "fresh snapshot delivered")
    fixture.reply(old, "late stale")
    await adelay(20)
    assert.deepEqual(values, ["snapshot", "snapshot"])
  })

  it("does not PUT or PATCH a subscription removed before OPEN", async () => {
    fixture = await lifetimeFixture()
    fixture.state.holdUpgrade = true
    const consumer = () => {}
    const subscribing = fixture.remote.topic.subscribe(consumer, {id: 1})
    await until(() => fixture.heldUpgrades.length === 1, "upgrade held")
    await fixture.remote.topic.unsubscribe(consumer, {id: 1})
    fixture.heldUpgrades.shift()!()
    await subscribing
    assert.lengthOf(fixture.requests, 0)
    assert.lengthOf(fixture.connections, 1, "unsubscribe did not open another socket")
  })

  it("bounds a held opening handshake by the default subscription deadline", async () => {
    fixture = await lifetimeFixture({callTimeout: 60})
    fixture.state.holdUpgrade = true
    const started = Date.now()
    const failed = rejection(fixture.remote.topic.subscribe(() => {}, {id: 1}))
    await until(() => fixture.heldUpgrades.length === 1, "upgrade held")
    assert.equal((await failed).code, RpcErrors.Timeout)
    assert.isBelow(Date.now() - started, 500)
    assert.lengthOf(fixture.requests, 0)
  })

  it("times out async headers without a late PUT and permits a same-lifetime retry", async () => {
    const headers = deferred<Record<string, string>>()
    let hold = true
    fixture = await lifetimeFixture({
      callTimeout: 60,
      getHeaders: async () => (hold ? headers.promise : {}),
    })
    await fixture.client.connect()
    const consumer = () => {}
    const failure = await rejection(fixture.remote.topic.subscribe(consumer, {id: 1}))
    assert.equal(failure.code, RpcErrors.Timeout)
    headers.resolve({})
    hold = false
    await adelay(20)
    assert.lengthOf(fixture.requests, 0, "late headers must not dispatch the expired request")
    await fixture.remote.topic.subscribe(() => {}, {id: 1})
    assert.equal(
      fixture.requests[0].lifetime,
      "1",
      "failed initial subscription retains its local lifetime",
    )
  })

  it("shares a per-call deadline between headers and a stalled HTTP body", async () => {
    fixture = await lifetimeFixture({
      getHeaders: async () => {
        await adelay(60)
        return {}
      },
    })
    await fixture.client.connect()
    fixture.state.slowNext = true
    const started = Date.now()
    const failure = await rejection(
      fixture.remote.topic.subscribe(() => {}, {id: 1}, new CallOptions({timeout: 120})),
    )
    assert.equal(failure.code, RpcErrors.Timeout)
    assert.lengthOf(fixture.pending, 1, "headers arrived and body remained incomplete")
    assert.isBelow(
      Date.now() - started,
      175,
      "HTTP must use the remaining budget, not restart 120ms",
    )
  })

  it("closes on missing protocol acknowledgement but retains acknowledged 429/503 recovery", async () => {
    fixture = await lifetimeFixture()
    await fixture.client.connect()
    for (const status of [503, 429]) {
      fixture.state.status = status
      assert.equal(
        (await rejection(fixture.remote.topic.subscribe(() => {}, {id: 1}))).code,
        status,
      )
      assert.isTrue(fixture.client.isConnected())
    }
    await fixture.remote.topic.subscribe(() => {}, {id: 1})
    fixture.state.acknowledge = false
    const failure = await rejection(fixture.remote.topic.subscribe(() => {}, {id: 2}))
    assert.include(failure.message, "does not support subscription lifetime")
    await until(() => !fixture.client.isConnected(), "unsupported client closes")
    const opened = fixture.connections.length
    fixture.client.reconnect({immediate: true})
    await adelay(20)
    assert.lengthOf(fixture.connections, opened, "unsupported mode cannot silently retry as legacy")
  })

  it("recovers from headerless gateway errors without closing or downgrading the client", async () => {
    fixture = await lifetimeFixture()
    await fixture.client.connect()
    fixture.state.errorHeader = false
    for (const status of [502, 503, 504]) {
      fixture.state.status = status
      fixture.state.acknowledge = false
      assert.equal(
        (await rejection(fixture.remote.topic.subscribe(() => {}, {id: 1}))).code,
        status,
      )
      assert.isTrue(fixture.client.isConnected(), "a gateway outage must not require relaunch")
      fixture.state.acknowledge = true
      await fixture.remote.topic.subscribe(() => {}, {id: 1})
    }
    assert.lengthOf(fixture.connections, 1)
    assert.isTrue(
      fixture.requests.every((r) => r.epoch === fixture.connections[0].epoch && r.lifetime === "1"),
    )
  })

  it("does not dispatch after parameter mutation resolves another registration during async headers", async () => {
    const headers = deferred<Record<string, string>>()
    let hold = false
    let waiting = false
    fixture = await lifetimeFixture({
      getHeaders: async () => {
        if (hold) {
          hold = false
          waiting = true
          return headers.promise
        }
        return {}
      },
    })
    await fixture.client.connect()
    const other: string[] = []
    await fixture.remote.topic.subscribe((v) => other.push(v), {id: 2})
    const filter = {id: 1}
    hold = true
    const subscribing = fixture.remote.topic.subscribe(() => {}, filter)
    await until(() => waiting, "headers held after wire key capture")
    filter.id = 2
    headers.resolve({})
    await subscribing
    assert.lengthOf(fixture.requests, 1, "the late request no longer owns its registration")
    assert.deepEqual(other, ["snapshot"])
  })

  it("does not dispatch a PUT removed while async middleware is waiting", async () => {
    const gate = deferred<void>()
    let entered = false
    fixture = await lifetimeFixture({
      middleware: [
        async (ctx, next) => {
          if (ctx.invocationType === InvocationType.Subscribe) {
            entered = true
            await gate.promise
          }
          return next()
        },
      ],
    })
    await fixture.client.connect()
    const consumer = () => {}
    const subscribing = fixture.remote.topic.subscribe(consumer, {id: 1})
    await until(() => entered, "subscribe middleware held")
    await fixture.remote.topic.unsubscribe(consumer, {id: 1})
    gate.resolve()
    await subscribing
    assert.isTrue(
      fixture.requests.every((r) => r.method === "PATCH"),
      "late middleware cannot revive the removed lifetime",
    )
  })

  it("bounds unsubscribe middleware and does not send its PATCH after the deadline", async () => {
    const gate = deferred<void>()
    let entered = false
    fixture = await lifetimeFixture({
      middleware: [
        async (ctx, next) => {
          if (ctx.invocationType === InvocationType.Unsubscribe) {
            entered = true
            await gate.promise
          }
          return next()
        },
      ],
    })
    const consumer = () => {}
    await fixture.remote.topic.subscribe(consumer, {id: 1})
    const failure = rejection(
      fixture.remote.topic.unsubscribe(consumer, {id: 1}, new CallOptions({timeout: 60})),
    )
    await until(() => entered, "unsubscribe middleware held")
    assert.equal((await failure).code, RpcErrors.Timeout)
    gate.resolve()
    await adelay(20)
    assert.lengthOf(fixture.requests, 1, "expired middleware must not dispatch a late PATCH")
  })

  it("serializes a middleware's wire parameters before async headers can mutate them", async () => {
    const headers = deferred<Record<string, string>>()
    let waiting = false
    const wireFilter = {id: 101}
    fixture = await lifetimeFixture({
      middleware: [async (_ctx, next) => next(wireFilter)],
      getHeaders: async () => {
        waiting = true
        return headers.promise
      },
    })
    await fixture.client.connect()
    const subscribing = fixture.remote.topic.subscribe(() => {}, {id: 1})
    await until(() => waiting, "headers held after serialization")
    wireFilter.id = 202
    headers.resolve({})
    await subscribing
    assert.deepEqual(fixture.requests[0].parameters, [{id: 101}])
  })

  it("preserves stable middleware parameter mapping for initial, recovery and PATCH", async () => {
    fixture = await lifetimeFixture({
      middleware: [
        async (ctx, next, parameter) => {
          const filter = parameter as {id: number}
          if (
            ctx.invocationType === InvocationType.Subscribe ||
            ctx.invocationType === InvocationType.Unsubscribe
          )
            return next({id: filter.id + 100})
          return next()
        },
      ],
    })
    const consumer = () => {}
    await fixture.remote.topic.subscribe(consumer, {id: 1})
    fixture.client.resubscribe()
    await until(() => fixture.requests.length === 2, "refresh sent through middleware")
    await fixture.remote.topic.unsubscribe(consumer, {id: 1})
    assert.isTrue(fixture.requests.every((r) => JSON.stringify(r.parameters) === '[{"id":101}]'))
    assert.isTrue(fixture.requests.every((r) => r.lifetime === fixture.requests[0].lifetime))
  })
})

describe("subscription lifetime option validation", () => {
  it("rejects lifetime mode without a WebSocket transport", async () => {
    const error = await rejection(
      consumeServices("http://127.0.0.1:1/rpc", {
        subscriptions: false,
        subscriptionLifetimes: true,
      }),
    )
    assert.equal(error.message, "subscriptionLifetimes requires subscriptions")
  })
})
