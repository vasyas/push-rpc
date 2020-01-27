// wait before giving answer before sending next call
// wait before asnwer before _accepting_ new call

import {createTestClient, startTestServer} from "./testUtils"
import {assert} from "chai"

describe("sync", () => {
  // wait for call end before sending next call
  it("subseq calls", async () => {
    let resolveCall
    let callNo

    await startTestServer({
      call(_callNo) {
        callNo = _callNo

        return new Promise(resolve => {
          resolveCall = resolve
        })
      },
    })

    const client = await createTestClient(0, {syncRemoteCalls: true})

    client.call(1)
    client.call(2)

    await new Promise(r => setTimeout(r, 100))
    assert.equal(callNo, 1)
    resolveCall()

    await new Promise(r => setTimeout(r, 100))
    assert.equal(callNo, 2)
    resolveCall()
  })

  it("subseq calls", async () => {
    let resolveCall
    let callNo

    await startTestServer({
      call(_callNo) {
        callNo = _callNo

        return new Promise(resolve => {
          resolveCall = resolve
        })
      },
    })

    const client = await createTestClient(0, {syncRemoteCalls: true})

    client.call(1)
    client.call(2)

    await new Promise(r => setTimeout(r, 100))
    assert.equal(callNo, 1)
    resolveCall()

    await new Promise(r => setTimeout(r, 100))
    assert.equal(callNo, 2)
    resolveCall()
  })
})
