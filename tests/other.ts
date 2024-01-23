describe("Other", () => {
  /*
  it("websocket misses 1st message due to async init", async () => {
    const services = await startTestServer(
      {
        async hello() {
          return "ok"
        },
      },
      {
        async createConnectionContext(): Promise<RpcConnectionContext> {
          await new Promise((resolve) => setTimeout(resolve, 50))

          return {
            remoteId: "remote",
          }
        },
      }
    )

    const client = await createTestClient<typeof services>()

    const r = await client.hello()
    console.log(r)
  })

   */
  // ability to specify no body and no content type for Combo/HTTP
})
