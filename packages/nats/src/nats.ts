import {JSONCodec, NatsConnection, Subscription, Subscription as NatsSubscription} from "nats"
import {HandleCall, TopicSubscription} from "./core"

export class NatsTransport {
  constructor(private serviceName: string, private connection: NatsConnection) {}

  // for servers
  publish<F, D>(topicName: string, filter: F, data: D) {
    // TODO encode filter in subject
    this.connection.publish(this.serviceName + ".rpc-data." + topicName, codec.encode(data))
  }

  listenCalls(handle: HandleCall) {
    subscribeAndHandle(
      this.connection,
      `${this.serviceName}.rpc-call.>`,
      (subject, body, respond) => {
        const parts = subject.split(".")
        parts.splice(0, 2)

        const itemName = parts[0]
        handle(itemName, body, respond)
      }
    )
  }

  // for clients

  async call<F, D>(itemName: string, requestBody: F): Promise<D> {
    const msg = await this.connection.request(
      this.serviceName + ".rpc-call." + itemName,
      codec.encode(requestBody)
    )
    return codec.decode(msg.data)
  }

  subscribeTopic<F>(topicName: string, filter: F, handle: (d: any) => void): TopicSubscription {
    // TODO include filter data in subject
    const subject = this.serviceName + ".rpc-data." + topicName

    const subscription = subscribeAndHandle(this.connection, subject, (_, data) => handle(data))

    return new NatsTopicSubscription(subscription)
  }
}

export class NatsTopicSubscription implements TopicSubscription {
  constructor(private subscription: NatsSubscription) {}

  public unsubscribe() {
    this.subscription.unsubscribe() // TODO or .drain?
  }
}

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
