import {assert} from "chai"
import http from "http"
import {gzipSync} from "zlib"
import {createTestClient, startTestServer, TEST_PORT} from "./testUtils.js"

function rawPost(
  path: string,
  headers: Record<string, string | number>,
  body: Buffer,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {host: "127.0.0.1", port: TEST_PORT, path, method: "POST", headers},
      (res) => {
        res.resume() // drain
        res.on("end", () => resolve(res.statusCode!))
      },
    )
    req.on("error", reject)
    req.end(body)
  })
}

describe("request size limit", () => {
  it("accepts a request body under maxRequestSize", async () => {
    const services = await startTestServer(
      {echo: async (s: string) => s},
      {maxRequestSize: 10_000},
    )

    const remote = await createTestClient<typeof services>()

    assert.equal(await remote.echo("hello"), "hello")
  })

  it("rejects a request body over maxRequestSize with 413", async () => {
    const services = await startTestServer(
      {echo: async (s: string) => s},
      {maxRequestSize: 100},
    )

    const remote = await createTestClient<typeof services>()

    try {
      await remote.echo("x".repeat(10_000))
      assert.fail("should have been rejected")
    } catch (e: any) {
      assert.equal(e.code, 413)
    }
  })

  it("rejects a decompression bomb (small gzip, huge decompressed body)", async () => {
    await startTestServer({echo: async (s: string) => s}, {maxRequestSize: 1000})

    const hugeBody = JSON.stringify(["a".repeat(5_000_000)]) // ~5 MB
    const compressed = gzipSync(Buffer.from(hugeBody)) // compresses to a few KB

    // sanity: the bomb is tiny on the wire but expands far beyond the limit
    assert.isBelow(compressed.length, 50_000)

    const status = await rawPost(
      "/rpc/echo",
      {
        "content-type": "application/json",
        "content-encoding": "gzip",
        "content-length": compressed.length,
      },
      compressed,
    )

    assert.equal(status, 413)
  })
})
