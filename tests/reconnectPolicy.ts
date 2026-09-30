import {assert} from "chai"
import {ReconnectScheduler, ReconnectRuntime} from "../src/client/ReconnectScheduler.js"
import {ReconnectPolicy} from "../src/client/index.js"
import {adelay} from "../src/utils/promises.js"
import {RecoveryFixture, recoveryFixture, until} from "./recoveryUtils.js"

const policy: ReconnectPolicy = {
  minDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  maxBackoffMs: 120000,
  stableConnectionMs: 30000,
  connectTimeoutMs: 10000,
}

class Clock implements ReconnectRuntime {
  time = 0
  seed = 9550
  private id = 0
  timers = new Map<number, {at: number; callback: () => void}>()
  now = () => this.time
  random = () => {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0
    return this.seed / 4294967296
  }
  setTimeout = (callback: () => void, delay: number) => {
    const id = ++this.id
    this.timers.set(id, {at: this.time + delay, callback})
    return id as unknown as ReturnType<typeof setTimeout>
  }
  clearTimeout = (id: ReturnType<typeof setTimeout>) => {
    this.timers.delete(id as unknown as number)
  }
  advance(ms: number) {
    const end = this.time + ms
    while (true) {
      let next: [number, {at: number; callback: () => void}] | undefined
      for (const candidate of this.timers) {
        if (!next || candidate[1].at < next[1].at) next = candidate
      }
      if (!next || next[1].at > end) break
      this.time = next[1].at
      this.timers.delete(next[0])
      next[1].callback()
    }
    this.time = end
  }
  suspend(ms: number) {
    this.time += ms
    // Like a resumed JS thread: overdue timers all run at the new current time.
    for (const [id, timer] of [...this.timers]) {
      if (timer.at > this.time) continue
      this.timers.delete(id)
      timer.callback()
    }
  }
}

describe("reconnect storm scheduling", () => {
  it("spreads 5000 simultaneous clients, including callbacks overdue after suspension", async function () {
    this.timeout(10000)
    const clock = new Clock()
    const schedulers = Array.from({length: 5000}, () => new ReconnectScheduler(policy, clock))
    let attempts = 0
    for (const scheduler of schedulers) void scheduler.wait().then(() => attempts++)
    clock.suspend(120000)
    await Promise.resolve()
    assert.equal(attempts, 0, "resuming must not flush all overdue attempts immediately")
    const perSecond: number[] = []
    for (let second = 0; second < 30; second++) {
      const previous = attempts
      clock.advance(1000)
      await Promise.resolve()
      perSecond.push(attempts - previous)
    }
    assert.equal(attempts, 5000)
    assert.isBelow(Math.max(...perSecond), 250, "less than 5% of the cohort in any second")
    assert.equal(perSecond[0], 0, "minimum recovery delay applies after resume too")
  })

  it("coalesces duplicate signals and widens retries until genuinely stable", async () => {
    const clock = new Clock()
    clock.random = () => 1
    const scheduler = new ReconnectScheduler(policy, clock)
    const first = scheduler.wait()
    clock.advance(5000)
    assert.strictEqual(scheduler.wait(), first)
    assert.equal([...clock.timers.values()][0].at, 30000, "duplicate cannot move the deadline")
    clock.advance(25000)
    assert.isTrue(await first)
    scheduler.connected()
    clock.advance(500)
    scheduler.disconnected()
    const second = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, 90500, "brief open does not reset backoff")
    clock.advance(60000)
    await second
    const third = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, 210500)
    clock.advance(120000)
    await third
    scheduler.connected()
    clock.advance(30000)
    scheduler.disconnected()
    const reset = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, 270500, "stable open resets to first window")
    scheduler.cancel()
    assert.isFalse(await reset)
    assert.equal(clock.timers.size, 0)
  })

  it("does not mistake suspended time for connection stability", async () => {
    const clock = new Clock()
    clock.random = () => 1
    const scheduler = new ReconnectScheduler(policy, clock)
    void scheduler.wait()
    clock.advance(30000)
    scheduler.connected()
    clock.suspend(60000)
    scheduler.disconnected()
    const next = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, 150000, "retry window remains 60 seconds")
    scheduler.cancel()
    await next
  })

  it("separates immediate first recovery from randomized exponential failed retries", async () => {
    const clock = new Clock()
    clock.random = () => 1
    const native: ReconnectPolicy = {
      minDelayMs: 1000,
      maxDelayMs: 5000,
      backoffFactor: 2,
      maxBackoffMs: 30000,
      stableConnectionMs: 30000,
      connectTimeoutMs: 10000,
      firstReconnectDelayMs: 0,
    }
    const scheduler = new ReconnectScheduler(native, clock)
    // Cold-start failure has not earned a stable-connection recovery: it backs off.
    const coldFailure = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, 5000)
    clock.advance(5000)
    await coldFailure
    scheduler.connected()
    clock.advance(30000)
    scheduler.disconnected()
    const immediate = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at, clock.time)
    clock.advance(0)
    assert.isTrue(await immediate)
    for (const expected of [5000, 10000, 20000, 30000, 30000]) {
      const retry = scheduler.wait()
      assert.equal([...clock.timers.values()][0].at - clock.time, expected)
      clock.advance(expected)
      assert.isTrue(await retry)
    }
    scheduler.expedite()
    clock.random = () => 0
    const lowerBound = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at - clock.time, 1000)
    scheduler.cancel()
    await lowerBound
  })

  it("expedites an existing backoff and resets the next failed retry to the base window", async () => {
    const clock = new Clock()
    clock.random = () => 1
    const scheduler = new ReconnectScheduler(
      {...policy, maxDelayMs: 5000, maxBackoffMs: 30000},
      clock,
    )
    for (const delay of [5000, 10000, 20000]) {
      const retry = scheduler.wait()
      clock.advance(delay)
      await retry
    }
    const delayed = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at - clock.time, 30000)
    scheduler.expedite()
    assert.isTrue(await delayed)
    assert.equal(clock.timers.size, 0)
    const nextFailure = scheduler.wait()
    assert.equal([...clock.timers.values()][0].at - clock.time, 5000)
    scheduler.cancel()
    await nextFailure
  })

  it("rejects invalid policy bounds instead of creating a tight retry loop", () => {
    for (const invalid of [
      {maxDelayMs: 0},
      {minDelayMs: NaN},
      {backoffFactor: 0.5},
      {connectTimeoutMs: 0},
      {maxBackoffMs: 1000},
      {stableConnectionMs: -1},
      {maxBackoffMs: 2147483648},
      {firstReconnectDelayMs: -1},
      {firstReconnectDelayMs: NaN},
      {firstReconnectDelayMs: 2147483648},
    ])
      assert.throws(() => new ReconnectScheduler({...policy, ...invalid}))
  })
})

describe("reconnect policy on a real loopback transport", () => {
  let fixture: RecoveryFixture
  const quick: ReconnectPolicy = {
    minDelayMs: 50,
    maxDelayMs: 50,
    backoffFactor: 2,
    maxBackoffMs: 200,
    stableConnectionMs: 1000,
    connectTimeoutMs: 80,
  }
  afterEach(async () => {
    await fixture?.close()
  })

  it("keeps initial connect fast and combines explicit and automatic recovery", async () => {
    fixture = await recoveryFixture({reconnectPolicy: {...quick, minDelayMs: 150, maxDelayMs: 150}})
    await fixture.client.connect()
    assert.lengthOf(fixture.connections, 1)
    fixture.connections[0].terminate()
    await until(() => !fixture.client.isConnected(), "native disconnection")
    fixture.client.reconnect()
    fixture.client.reconnect()
    await adelay(40)
    assert.lengthOf(fixture.connections, 1, "explicit signal did not bypass the automatic delay")
    await until(() => fixture.connections.length === 2, "one scheduled replacement")
    await adelay(40)
    assert.lengthOf(fixture.connections, 2)
  })

  it("retires a healthy old TCP connection and preserves the consumer on the delayed replacement", async () => {
    fixture = await recoveryFixture({reconnectPolicy: quick})
    const values: string[] = []
    await fixture.client.connect()
    await fixture.remote.topic.subscribe((value) => values.push(value), 1)
    fixture.state.value = "recovered"
    fixture.client.reconnect()
    await until(() => fixture.connections[0].readyState === 3, "healthy old socket closed")
    await until(() => values.at(-1) === "recovered", "replacement snapshot")
    fixture.publish("live")
    await until(() => values.at(-1) === "live", "same consumer receives live push")
  })

  it("bounds a stalled opening handshake; duplicates cannot starve it or force another attempt", async () => {
    fixture = await recoveryFixture({reconnectPolicy: quick})
    fixture.state.holdUpgrade = true
    const connected = fixture.client.connect()
    await until(() => fixture.state.upgrades === 1, "initial handshake")
    // Abandon the initial attempt, then issue duplicates during its replacement.
    fixture.client.reconnect()
    await until(() => fixture.state.upgrades === 2, "first jittered replacement")
    for (let i = 0; i < 4; i++) {
      fixture.client.reconnect()
      await adelay(10)
    }
    assert.equal(fixture.state.upgrades, 2)
    fixture.state.holdUpgrade = false
    await until(
      () => fixture.connections.length === 1,
      "timeout advances to another jittered attempt",
    )
    await connected
    assert.equal(fixture.state.upgrades, 3)
  })

  it("cancels delayed recovery permanently on close", async () => {
    fixture = await recoveryFixture({reconnectPolicy: quick})
    await fixture.client.connect()
    fixture.client.reconnect()
    await fixture.client.close()
    fixture.client.reconnect()
    await adelay(250)
    assert.lengthOf(fixture.connections, 1)
  })

  it("recovers automatically without delay after a stable connection", async () => {
    fixture = await recoveryFixture({
      reconnectPolicy: {
        ...quick,
        firstReconnectDelayMs: 0,
        minDelayMs: 1000,
        maxDelayMs: 5000,
        maxBackoffMs: 30000,
        stableConnectionMs: 20,
        connectTimeoutMs: 10000,
      },
    })
    await fixture.client.connect()
    await adelay(40)
    fixture.connections[0].terminate()
    await until(() => fixture.connections.length === 2, "zero-delay first recovery", 750)
  })

  it("explicit network regain wakes a thirty-second backoff promptly and only once", async () => {
    fixture = await recoveryFixture({
      reconnectPolicy: {
        ...quick,
        minDelayMs: 30000,
        maxDelayMs: 30000,
        maxBackoffMs: 30000,
        connectTimeoutMs: 10000,
      },
    })
    await fixture.client.connect()
    fixture.connections[0].terminate()
    await until(() => !fixture.client.isConnected(), "old connection closed")
    await adelay(10)
    fixture.client.reconnect({immediate: true})
    fixture.client.reconnect({immediate: true})
    fixture.client.reconnect({immediate: true})
    await until(() => fixture.connections.length === 2, "immediate wake-up", 750)
    await adelay(30)
    assert.equal(fixture.state.upgrades, 2)
  })

  it("immediate recovery abandons a silent close and preserves the existing consumer", async () => {
    fixture = await recoveryFixture({reconnectPolicy: quick, resubscribeConcurrency: 2})
    const values: string[] = []
    await fixture.client.connect()
    await fixture.remote.topic.subscribe((value) => values.push(value), 1)
    fixture.clientSockets[0].hangClose = true
    fixture.state.value = "fresh"
    fixture.client.reconnect({immediate: true})
    await until(() => values.at(-1) === "fresh", "fresh replacement snapshot")
    fixture.clientSockets[0].emit("close", 1006, Buffer.alloc(0))
    fixture.publish("live")
    await until(() => values.at(-1) === "live", "late old close cannot break live consumer")
    assert.equal(fixture.connections.length, 2)
  })

  it("immediate duplicates reuse an opening handshake without postponing its timeout", async () => {
    fixture = await recoveryFixture({
      reconnectPolicy: {
        ...quick,
        minDelayMs: 30,
        maxDelayMs: 30,
        maxBackoffMs: 200,
        connectTimeoutMs: 120,
      },
    })
    fixture.state.holdUpgrade = true
    const connected = fixture.client.connect()
    await until(() => fixture.state.upgrades === 1, "initial pending handshake")
    for (let i = 0; i < 5; i++) {
      fixture.client.reconnect({immediate: true})
      await adelay(10)
    }
    assert.equal(fixture.state.upgrades, 1, "one attempt despite duplicate signals")
    fixture.state.holdUpgrade = false
    await until(() => fixture.connections.length === 1, "opening timeout still advances recovery")
    await connected
    assert.equal(fixture.state.upgrades, 2)
  })

  it("can opt into spreading the first connection too", async () => {
    fixture = await recoveryFixture({reconnectPolicy: {...quick, spreadInitialConnect: true}})
    const connected = fixture.client.connect()
    await adelay(20)
    assert.equal(fixture.state.upgrades, 0)
    await connected
    assert.equal(fixture.state.upgrades, 1)
  })
})
