import {JSONCodec, NatsConnection, Subscription as NatsSubscription} from "nats"
import {DataConsumer, DataSupplier, LocalTopic, RemoteTopic, Topic} from "../../core/src"
import {subscribeAndHandle} from "./utils"

export {DataSupplier, DataConsumer, LocalTopic, RemoteTopic, Topic}

export type Method = (req?, ctx?) => Promise<any>
export type ServiceItem =
  | {method: Method; object: any}
  | {topic: LocalTopic<never, never>; object: any}

export type HandleCall = (itemName: string, body: any, respond) => void

export const ITEM_NAME_SEPARATOR = "/"

export class Transport {
  constructor(private serviceName: string, private connection: NatsConnection) {}

  // for servers
  publish<F, D>(topicName: string, filter: F, data: D) {
    // TODO encode filter in subject
    this.connection.publish(this.serviceName + ".rpc-data." + topicName, this.codec.encode(data))
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
      this.codec.encode(requestBody)
    )
    return this.codec.decode(msg.data)
  }

  subscribeTopic<F>(topicName: string, filter: F, handle: (d: any) => void): TopicSubscription {
    // TODO include filter data in subject
    const subject = this.serviceName + ".rpc-data." + topicName

    const subscription = subscribeAndHandle(this.connection, subject, (_, data) => handle(data))

    return new TopicSubscription(subscription)
  }

  private codec = JSONCodec()
}

export class TopicSubscription {
  constructor(private subscription: NatsSubscription) {}

  public unsubscribe() {
    this.subscription.unsubscribe() // TODO or .drain?
  }
}

export class LocalTopicImpl<D, F, TD = D> implements Topic<D, F, TD> {
  constructor(readonly supplier: DataSupplier<D, F>) {}

  private name: string
  private transport: Transport

  getTopicName(): string {
    return this.name
  }

  setTopicName(s: string) {
    this.name = s
  }

  setTransport(transport: Transport) {
    this.transport = transport
  }

  /**
   * Send data
   */
  trigger(p: Partial<F> = {}, data?: TD): void {
    if (!this.transport)
      throw new Error(`Topic ${this.name} transport is not set, server probably not started`)
    ;(async () => {
      if (data === undefined) {
        data = (await this.supplier(p as any, null)) as any
      }

      console.log("Publinshing data", data)

      this.transport.publish(this.getTopicName(), p, data)
    })()
  }

  // only required fort ServiceImpl to implement Service interfaces
  async get(params?: F): Promise<D> {
    return undefined
  }

  async subscribe(consumer: DataConsumer<D>, params?: F, subscriptionKey?: any): Promise<any> {}

  unsubscribe(params?: F, subscriptionKey?: any) {}
}
