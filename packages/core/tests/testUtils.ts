import {connect, NatsConnection} from "nats"
import {NatsTransport} from "../../nats/src/nats"
import {createRpcClient} from "../src/client"
import {createRpcServer} from "../src/server"

let clientConnection: NatsConnection = null
let serverConnection: NatsConnection = null

export async function startTestServer(services, options?) {
  if (!serverConnection) {
    serverConnection = await connect()
  }

  const transport = new NatsTransport("test", serverConnection)
  await createRpcServer(services, transport, options)
}

afterEach(async () => {
  clientConnection && (await clientConnection.close())
  serverConnection && (await serverConnection.close())

  clientConnection = null
  serverConnection = null
})

export async function createTestClient(level = 1, options?, transportOptions?) {
  if (!clientConnection) {
    clientConnection = await connect()
  }

  const transport = new NatsTransport("test", clientConnection, transportOptions)

  return await createRpcClient(level, transport, options)
}

export function adelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
