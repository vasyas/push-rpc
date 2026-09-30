import {assert} from "chai"
import {RemoteSubscriptions} from "../src/client/RemoteSubscriptions.js"
import {ClientCache} from "../src/client/index.js"

// Applications may keep and mutate the object they subscribed with, including from
// inside a consumer callback. A subscription stays registered under the key it was
// added with, so a request handle must only ever write to the registration its
// parameters resolve to at that moment - for consumers and for the external cache.
describe("subscriptions with mutated parameters", () => {
  it("does not apply a stale snapshot to another subscription", () => {
    const subscriptions = new RemoteSubscriptions(null)
    const filter = {id: 1}
    const received: unknown[] = []

    subscriptions.addSubscription("topic", [filter], () => {})
    const stale = subscriptions.beginRequest("topic", [filter])

    subscriptions.addSubscription("topic", [{id: 2}], (data) => received.push(data))
    subscriptions.beginRequest("topic", [{id: 2}]).deliver("fresh")

    filter.id = 2
    assert.isFalse(stale.deliver("stale"), "the stale reply no longer owns a registration")
    assert.deepEqual(received, ["fresh"])
  })

  it("does not write a queued message into another subscription's cache entry", () => {
    const entries = new Map<string, unknown>()
    const key = (itemName: string, parameters: unknown[]) => itemName + JSON.stringify(parameters)
    const cache: ClientCache = {
      put: (itemName, parameters, value) => void entries.set(key(itemName, parameters), value),
      get: (itemName, parameters) => entries.get(key(itemName, parameters)),
    }
    const subscriptions = new RemoteSubscriptions(cache)

    const filter = {id: 1}
    // The snapshot callback mutates the object this subscription was registered with.
    subscriptions.addSubscription("topic", [filter], () => {
      filter.id = 2
    })
    const request = subscriptions.beginRequest("topic", [filter])
    subscriptions.consume("topic", [{id: 1}], "queued") // arrives while the snapshot is pending

    subscriptions.addSubscription("topic", [{id: 2}], () => {})
    subscriptions.beginRequest("topic", [{id: 2}]).deliver("other")

    request.deliver("snapshot")

    assert.equal(cache.get("topic", [{id: 2}]), "other", "the other cache entry was overwritten")
    assert.equal(cache.get("topic", [{id: 1}]), "snapshot")
  })

  it("leaves the queue to a newer request that a consumer callback started", () => {
    const subscriptions = new RemoteSubscriptions(null)
    const received: unknown[] = []
    let newer: ReturnType<RemoteSubscriptions["beginRequest"]> | null = null

    subscriptions.addSubscription("topic", [{id: 1}], (data) => {
      received.push(data)
      if (newer) return
      // A callback that resubscribes starts a new generation and queues behind it.
      newer = subscriptions.beginRequest("topic", [{id: 1}])
      subscriptions.consume("topic", [{id: 1}], "queued for newer")
    })

    subscriptions.beginRequest("topic", [{id: 1}]).deliver("superseded snapshot")
    assert.deepEqual(received, ["superseded snapshot"], "the newer queue was drained too early")

    assert.isTrue(newer!.deliver("newer snapshot"))
    assert.deepEqual(received, ["superseded snapshot", "newer snapshot", "queued for newer"])
  })

  it("still delivers to the subscription that owns the request", () => {
    const subscriptions = new RemoteSubscriptions(null)
    const received: unknown[] = []

    subscriptions.addSubscription("topic", [{id: 1}], (data) => received.push(data))
    const request = subscriptions.beginRequest("topic", [{id: 1}])

    subscriptions.consume("topic", [{id: 1}], "update")
    assert.isTrue(request.deliver("snapshot"))
    assert.deepEqual(received, ["snapshot", "update"])
  })
})
