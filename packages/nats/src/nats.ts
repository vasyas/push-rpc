import {JSONCodec, NatsConnection, Subscription, Subscription as NatsSubscription} from "nats"
import {dateToIsoString, DataFilter, HandleCall, TopicSubscription, Transport} from "../../core/src"

export class NatsTransport implements Transport {
  constructor(private serviceName: string, private connection: NatsConnection) {}

  // for servers
  publish(topicName: string, filter: DataFilter, data: any) {
    this.connection.publish(
      this.serviceName + ".rpc-data." + topicName + encodeFilterSubject(filter),
      codec.encode(data)
    )
  }

  listenCalls(handle: HandleCall) {
    subscribeAndHandle(
      this.connection,
      `${this.serviceName}.rpc-call.>`,
      (subject, body, respond) => {
        const parts = subject.split(".")
        parts.splice(0, 2)

        const itemName = parts[0]
        handle(
          itemName,
          body,
          body => respond(body),
          error => {
            const err = Object.getOwnPropertyNames(error)
              .filter(prop => prop != "stack" && prop != "message" && prop != "code")
              .reduce((r, key) => ({...r, [key]: error[key]}), {})

            respond({
              _rpcError: {
                ...err,
                message: error.message,
              },
            })
          }
        )
      }
    )
  }

  // for clients

  async call(itemName: string, requestBody: DataFilter): Promise<any> {
    const msg = await this.connection.request(
      this.serviceName + ".rpc-call." + itemName,
      codec.encode(requestBody)
    )
    const response = codec.decode(msg.data)

    processRpcError(response)
    return response
  }

  subscribeTopic(
    topicName: string,
    filter: DataFilter,
    handle: (d: any) => void
  ): TopicSubscription {
    const subject = this.serviceName + ".rpc-data." + topicName + encodeFilterSubject(filter)

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

function encodeFilterSubject(filter: DataFilter) {
  if (!Object.keys(filter).length) return ""

  const orderedKeys = Object.keys(filter).sort()

  return (
    "." +
    orderedKeys
      .map(key => {
        const value = filter[key]
        if (value == null) return "*"
        if (isLiteral(value)) return value
        if (value instanceof Date) return dateToIsoString(value)

        throw new Error(
          `Unsupported ${typeof value}  value under key ${key}, only literal or Dates should be used`
        )
      })
      .join(".")
  )
}

function isLiteral(value) {
  const t = typeof value
  return t == "bigint" || t == "boolean" || t == "string" || t == "number"
}

function processRpcError(response) {
  if (response._rpcError) {
    const error = new Error(response._rpcError.message)
    Object.assign(error, response.rpcError)
    throw error
  }
}
