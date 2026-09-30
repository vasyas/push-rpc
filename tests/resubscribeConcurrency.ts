import {assert} from "chai"
import {adelay} from "../src/utils/promises.js"
import {RecoveryFixture, recoveryFixture, reply, until} from "./recoveryUtils.js"

describe("bounded recovery snapshots", () => {
  let fixture: RecoveryFixture
  afterEach(async () => {
    await fixture?.close()
  })

  it("counts unfinished previous waves and discards obsolete queued and unsubscribed work", async () => {
    fixture = await recoveryFixture({resubscribeConcurrency: 2})
    await fixture.client.connect()
    const values = new Map<number, string>()
    const consumers = [1, 2, 3, 4].map((id) => (value: string) => {
      values.set(id, value)
    })
    for (let id = 1; id <= 4; id++) await fixture.remote.topic.subscribe(consumers[id - 1], id)
    fixture.requests.length = 0
    fixture.state.holdAll = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 2, "first two HTTP snapshots held")
    fixture.client.resubscribe()
    fixture.client.resubscribe()
    await adelay(30)
    assert.lengthOf(fixture.pending, 2, "old HTTP requests still occupy both slots")
    await fixture.remote.topic.unsubscribe(consumers[3], 4)
    reply(fixture.pending[0], "obsolete")
    reply(fixture.pending[1], "obsolete")
    await until(() => fixture.pending.length === 4, "latest wave gets released slots")
    // Concurrent HTTP connections may arrive in either order within each two-request wave.
    assert.deepEqual(
      fixture.requests
        .slice(0, 2)
        .map((r) => r.parameters[0])
        .sort(),
      [1, 2],
    )
    assert.deepEqual(
      fixture.requests
        .slice(2, 4)
        .map((r) => r.parameters[0])
        .sort(),
      [1, 2],
    )
    assert.equal(values.get(1), "initial", "obsolete response cannot update the consumer")
    reply(fixture.pending[2], "latest")
    reply(fixture.pending[3], "latest")
    await until(() => fixture.pending.length === 5, "remaining latest topic starts")
    assert.equal(fixture.requests.length, 5)
    assert.equal(fixture.requests[4].parameters[0], 3)
    reply(fixture.pending[4], "latest")
    await until(() => values.get(3) === "latest", "all current consumers refreshed")
    assert.deepEqual([...values.values()], ["latest", "latest", "latest", "initial"])
  })

  it("does not deadlock awaited initial subscriptions superseded by queued recovery", async () => {
    fixture = await recoveryFixture({resubscribeConcurrency: 2})
    await fixture.client.connect()
    fixture.state.holdAll = true
    const values: string[] = []
    const first = fixture.remote.topic.subscribe((value) => values.push(value), 1)
    const second = fixture.remote.topic.subscribe((value) => values.push(value), 2)
    await until(() => fixture.pending.length === 2, "initial HTTP work held")
    fixture.client.resubscribe()
    await adelay(20)
    assert.lengthOf(fixture.pending, 2)
    reply(fixture.pending[0], "old", 500)
    reply(fixture.pending[1], "old")
    await until(
      () => fixture.pending.length === 4,
      "HTTP completion releases slots before awaiting new generation",
    )
    reply(fixture.pending[2], "fresh")
    reply(fixture.pending[3], "fresh")
    await Promise.all([first, second])
    assert.deepEqual(values, ["fresh", "fresh"])
  })

  it("releases a recovery slot when headers arrive but the response body stalls", async () => {
    fixture = await recoveryFixture({resubscribeConcurrency: 1, callTimeout: 200})
    await fixture.client.connect()
    const values = new Map<number, string>()
    for (const id of [1, 2]) {
      await fixture.remote.topic.subscribe((value) => {
        values.set(id, value)
      }, id)
    }
    fixture.state.holdAll = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 1, "first recovery request held")
    fixture.pending[0].setHeader("Content-Type", "application/json")
    fixture.pending[0].flushHeaders()
    await until(() => fixture.pending.length === 2, "body timeout releases the slot", 1000)
    reply(fixture.pending[1], "fresh")
    await until(() => values.get(2) === "fresh", "next topic still recovers")
    assert.equal(values.get(1), "initial")
  })

  it("continues queued work after a failed snapshot and never starts it after close", async () => {
    fixture = await recoveryFixture({resubscribeConcurrency: 1})
    await fixture.client.connect()
    for (const id of [1, 2, 3]) await fixture.remote.topic.subscribe(() => {}, id)
    fixture.state.holdAll = true
    fixture.client.resubscribe()
    await until(() => fixture.pending.length === 1, "one recovery request")
    reply(fixture.pending[0], "failure", 500)
    await until(() => fixture.pending.length === 2, "error releases the slot")
    await fixture.client.close()
    reply(fixture.pending[1], "late")
    await adelay(30)
    assert.lengthOf(fixture.pending, 2, "third queued request was disposed")
  })
})
