import {assert} from "chai"
import {createServer} from "node:http"
import {AddressInfo, Socket} from "node:net"
import {consumeServices, CallOptions, RpcErrors} from "../src/index.js"

type Services = {
  large(): Promise<{value: string}>
  slow(): Promise<{value: string}>
  fast(): Promise<{value: string}>
}

// A real chunked HTTP response separates header arrival from body completion.
// publishServices normally sends both together, hiding this timeout boundary.
async function responseFixture(callTimeout: number) {
  const sockets = new Set<Socket>()
  const largeValue = "0123456789abcdef".repeat(128 * 1024)
  const server = createServer(async (request, response) => {
    for await (const _chunk of request) {
      // Consume the real RPC request before producing the response.
    }
    response.setHeader("Content-Type", "application/json")
    if (request.url === "/rpc/slow") {
      response.flushHeaders()
      response.write('{"value":"')
      const timer = setTimeout(() => response.end('slow complete"}'), 150)
      response.on("close", () => clearTimeout(timer))
    } else if (request.url === "/rpc/large") {
      response.write('{"value":"')
      // Honor TCP backpressure while delivering a response much larger than a packet.
      for (let offset = 0; offset < largeValue.length; offset += 65536) {
        if (!response.write(largeValue.slice(offset, offset + 65536))) {
          await new Promise<void>((resolve) => response.once("drain", resolve))
        }
      }
      response.end('"}')
    } else {
      response.end('{"value":"fast complete"}')
    }
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const {client, remote} = await consumeServices<Services>(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/rpc`,
    {subscriptions: false, callTimeout},
  )
  return {
    client,
    remote,
    largeValue,
    async close() {
      await client.close()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

describe("large and slow HTTP replies", () => {
  let fixture: Awaited<ReturnType<typeof responseFixture>>
  afterEach(async () => {
    await fixture?.close()
  })

  it("receives an intact 2 MiB chunked response with subscriptions disabled", async () => {
    fixture = await responseFixture(2000)
    const result = await fixture.remote.large()
    assert.equal(result.value.length, 2 * 1024 * 1024)
    assert.isTrue(result.value === fixture.largeValue, "all response chunks must be preserved")
    assert.isNull(fixture.client._webSocket())
  })

  it("times out a stalled body after headers and permits the next ordinary RPC", async () => {
    fixture = await responseFixture(60)
    await fixture.remote.slow().then(
      () => assert.fail("Receiving headers must not cancel the timeout"),
      (error) => assert.equal(error.code, RpcErrors.Timeout),
    )
    assert.deepEqual(await fixture.remote.fast(), {value: "fast complete"})
  })

  it("honors a longer per-call deadline for a slow body without changing the default", async () => {
    fixture = await responseFixture(60)
    assert.deepEqual(await fixture.remote.slow(new CallOptions({timeout: 500})), {
      value: "slow complete",
    })
    await fixture.remote.slow().then(
      () => assert.fail("The override must not change later calls' default deadline"),
      (error) => assert.equal(error.code, RpcErrors.Timeout),
    )
  })
})
