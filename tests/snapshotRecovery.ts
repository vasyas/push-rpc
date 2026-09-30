import {assert} from "chai"
import {CallOptions, RpcErrors} from "../src/rpc.js"
import {adelay} from "../src/utils/promises.js"
import {RecoveryFixture, recoveryFixture, reply, until} from "./recoveryUtils.js"

describe("subscription snapshot recovery", () => {
  let fixture: RecoveryFixture

  beforeEach(async () => {
    fixture = await recoveryFixture()
    await fixture.client.connect()
  })

  afterEach(async () => {
    await fixture?.close()
  })

  for (const oldStatus of [200, 500]) {
    it(`delivers new data before the old request completes with HTTP ${oldStatus}`, async () => {
      fixture.state.holdNext = true
      const values: string[] = []
      const initial = fixture.remote.topic.subscribe((value) => values.push(value), 1)
      await until(() => fixture.pending.length === 1, "initial request held")
      fixture.state.value = "fresh"
      fixture.client.reconnect()
      await until(() => values.includes("fresh"), "replacement bypasses the stale pause")
      fixture.publish("newer-push")
      await until(() => values.at(-1) === "newer-push", "push arrives before stale reply")
      reply(fixture.pending[0], "stale", oldStatus)
      await initial
      assert.equal(values.at(-1), "newer-push")
      fixture.publish("after-stale-reply")
      await until(() => values.at(-1) === "after-stale-reply", "push remains active")
    })
  }

  it("keeps await subscribe pending until the replacement delivers data", async () => {
    fixture.state.holdNext = true
    const values: string[] = []
    let completed = false
    const initial = fixture.remote.topic
      .subscribe((value) => values.push(value), 2)
      .then(() => {
        completed = true
      })
    await until(() => fixture.pending.length === 1, "initial request held")
    fixture.state.holdNext = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 2, "replacement held")
    reply(fixture.pending[0], "stale")
    await adelay(30)
    assert.isFalse(completed)
    reply(fixture.pending[1], "fresh")
    await initial
    assert.deepEqual(values, ["fresh"])
  })

  it("propagates a replacement failure to the waiting subscriber", async () => {
    fixture.state.holdNext = true
    const initial = fixture.remote.topic
      .subscribe(() => {}, 3)
      .then(
        () => assert.fail("replacement failure must reject subscribe"),
        (error) => assert.equal(error.code, 500),
      )
    await until(() => fixture.pending.length === 1, "initial request held")
    fixture.state.holdNext = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 2, "replacement held")
    reply(fixture.pending[0], "stale")
    reply(fixture.pending[1], "failure", 500)
    await initial
  })

  it("preserves an explicit subscribe deadline while the replacement is pending", async () => {
    fixture.state.holdNext = true
    const initial = fixture.remote.topic
      .subscribe(() => {}, 4, new CallOptions({timeout: 80}))
      .then(
        () => assert.fail("the explicit deadline must still apply"),
        (error) => assert.equal(error.code, RpcErrors.Timeout),
      )
    await until(() => fixture.pending.length === 1, "initial request held")
    fixture.state.holdNext = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 2, "replacement held")
    await initial
    reply(fixture.pending[1], "after-deadline")
  })

  it("preserves the deadline even when a stale HTTP response arrives before it", async () => {
    fixture.state.holdNext = true
    const initial = fixture.remote.topic
      .subscribe(() => {}, 8, new CallOptions({timeout: 80}))
      .then(
        () => assert.fail("waiting for a replacement must not extend the explicit deadline"),
        (error) => assert.equal(error.code, RpcErrors.Timeout),
      )
    await until(() => fixture.pending.length === 1, "initial request held")
    fixture.state.holdNext = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 2, "replacement held")
    reply(fixture.pending[0], "stale")
    const release = setTimeout(() => reply(fixture.pending[1], "too-late"), 150)
    try {
      await initial
    } finally {
      clearTimeout(release)
    }
  })

  it("follows the latest generation when several reconnect snapshots overlap", async () => {
    fixture.state.holdNext = true
    const values: string[] = []
    const initial = fixture.remote.topic.subscribe((value) => values.push(value), 5)
    await until(() => fixture.pending.length === 1, "initial request held")
    for (let i = 2; i <= 3; i++) {
      fixture.state.holdNext = true
      fixture.client.resubscribe()
      await until(() => fixture.pending.length === i, "replacement held")
    }
    reply(fixture.pending[2], "latest")
    await until(() => values.at(-1) === "latest", "latest generation delivered")
    reply(fixture.pending[1], "middle")
    reply(fixture.pending[0], "oldest", 500)
    await initial
    await adelay(20)
    assert.deepEqual(values, ["latest"])
  })

  it("does not let an old subscription lifetime overwrite a new one with the same parameters", async () => {
    fixture.state.holdNext = true
    const oldValues: string[] = []
    const oldConsumer = (value: string) => oldValues.push(value)
    let oldCompleted = false
    const old = fixture.remote.topic.subscribe(oldConsumer, 6).then(() => {
      oldCompleted = true
    })
    await until(() => fixture.pending.length === 1, "old lifetime held")
    await fixture.remote.topic.unsubscribe(oldConsumer, 6)
    fixture.state.holdNext = true
    const newValues: string[] = []
    const fresh = fixture.remote.topic.subscribe((value) => newValues.push(value), 6)
    await until(() => fixture.pending.length === 2, "new lifetime held")
    reply(fixture.pending[0], "old")
    await until(() => oldCompleted, "old lifetime finishes without waiting for a new consumer")
    assert.deepEqual(oldValues, [])
    assert.deepEqual(newValues, [])
    reply(fixture.pending[1], "new")
    await Promise.all([old, fresh])
    assert.deepEqual(newValues, ["new"])
  })

  it("does not resurrect an unsubscribed consumer during recovery", async () => {
    fixture.state.holdNext = true
    const values: string[] = []
    const consumer = (value: string) => values.push(value)
    const initial = fixture.remote.topic.subscribe(consumer, 7)
    await until(() => fixture.pending.length === 1, "initial request held")
    await fixture.remote.topic.unsubscribe(consumer, 7)
    fixture.client.reconnect()
    reply(fixture.pending[0], "unmounted")
    await initial
    await until(() => fixture.connections.length === 2, "connection recovered")
    assert.deepEqual(values, [])
    assert.lengthOf(fixture.client._allSubscriptions(), 0)
  })
})
