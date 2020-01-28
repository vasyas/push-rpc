import {createTestClient, startTestServer} from "./testUtils"
import {assert} from "chai"

describe("sync", () => {
  // wait for call end before sending next call
  it("subseq calls", async () => {
    let resolveCall
    let callNo

    await startTestServer({
      remoteFunc(_callNo) {
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

  false && it("wait local answer before calling remote", async () => {
    let resolveCall
    let remoteId
    let remoteInvoked

    const testServer = await startTestServer({
      call(_, ctx) {
        remoteId = ctx.remoteId

        return new Promise(resolve => {
          resolveCall = resolve
        })
      },
    })

    const client = await createTestClient(0, {
      syncRemoteCalls: true,
      local: {
        remoteFunc() {
          remoteInvoked = true
        },
      },
    })

    client.call()

    await new Promise(r => setTimeout(r, 100))
    const remote = testServer.getRemote(remoteId)
    remote.remoteFunc()

    await new Promise(r => setTimeout(r, 100))
    assert.notOk(remoteInvoked) // waiting for call to resolve

    resolveCall()
    await new Promise(r => setTimeout(r, 100))
    assert.ok(remoteInvoked)
    resolveCall()
  })

  // wait before asnwer before _accepting_ new call
})
