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

  it("handle unsynced clients", async () => {
    let resolveServerCall
    let resolveClientCall

    let clientResponse
    let serverResponse

    const rpcServer = await startTestServer(
      {
        callServer() {
          console.log("Server called")
          return new Promise(resolve => {
            resolveServerCall = resolve
          })
        },
      },
      {
        syncRemoteCalls: true,
        listeners: {
          connected: (id, total) => {
            setTimeout(async () => {
              const client = await rpcServer.getRemote(id)
              console.log("Try to call client")
              clientResponse = await client.callClient()
            }, 100)
          },
          disconnected: (id, total) => {},
          messageIn: (remoteId, data) => {
            console.log("IN", data)
          },
          messageOut: (remoteId, data) => {
            console.log("OUT", data)
          },
          subscribed: () => {},
          unsubscribed: () => {},
        },
      }
    )

    const client = {
      callClient() {
        console.log("Client called")
        return new Promise(resolve => {
          resolveClientCall = resolve
        })
      },
    }

    const server = await createTestClient(0, {local: client})

    // wait for server to call client
    await new Promise(r => setTimeout(r, 200))

    // client call is not resolved yet.
    // but let client make his call to server
    server.callServer().then(r => {
      serverResponse = r
    })

    // and immediately respond
    resolveClientCall("client ok")

    await new Promise(r => setTimeout(r, 100))
    resolveServerCall("server ok")

    // give some time to complete all cbs
    await new Promise(r => setTimeout(r, 50))

    // make sure all have responded with correct values
    assert.equal(serverResponse, "server ok")
    assert.equal(clientResponse, "client ok")
  })

  false &&
    it("wait local answer before calling remote", async () => {
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

  it("delay before sending next call", async () => {
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

    const client = await createTestClient(0, {syncRemoteCalls: true, delayCalls: 150})

    client.call(1)
    client.call(2)

    await new Promise(r => setTimeout(r, 100))
    assert.equal(callNo, 1)
    resolveCall()

    await new Promise(r => setTimeout(r, 100)) // 200 ms from last response
    assert.equal(callNo, 2)
    resolveCall()
  })

  it("wait before sending next call after receiving response", async () => {
    let callNo

    const server = await startTestServer({
      async call(_callNo) {
        callNo = _callNo
      },
    })

    const client = await createTestClient(0, {
      syncRemoteCalls: true,
      delayCalls: 150,
      local: {
        async test() {
          console.log("Client local")
        },
      },
    })

    const remoteClient = server.getRemote(server.getConnectedIds()[0])

    await remoteClient.test()
    client.call(1)

    await new Promise(r => setTimeout(r, 100))
    assert.isUndefined(callNo)

    await new Promise(r => setTimeout(r, 100)) // 200 ms since response
    assert.equal(callNo, 1)
  })
})
