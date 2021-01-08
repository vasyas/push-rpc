import {JSONCodec, NatsConnection, Subscription} from "nats"

const codec = JSONCodec()

export function subscribeAndHandle(
  connection: NatsConnection,
  subject: string,
  handle: (subject: string, body: any, respond) => void
) {
  const subscription = connection.subscribe(subject)

  messageLoop(subscription, handle)

  return subscription
}

async function messageLoop(
  subscription: Subscription,
  handle: (subject: string, body: any, respond) => void
) {
  for await (const msg of subscription) {
    const body = codec.decode(msg.data)

    handle(msg.subject, body, r => msg.respond(codec.encode(r)))
  }
}
