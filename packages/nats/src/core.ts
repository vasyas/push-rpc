import {JSONCodec, NatsConnection} from "nats"
import {DataConsumer, DataSupplier, LocalTopic, RemoteTopic, Topic} from "../../core/src"

export {DataSupplier, DataConsumer, LocalTopic, RemoteTopic, Topic}

export type Method = (req?, ctx?) => Promise<any>
export type ServiceItem =
  | {method: Method; object: any}
  | {topic: LocalTopic<never, never>; object: any}

export class Transport {
  constructor(private serviceName: string, private connection: NatsConnection) {}

  publish<F, D>(topicName: string, filter: F, data: D) {
    // TODO encode filter in subject
    this.connection.publish(this.serviceName + "." + topicName, this.codec.encode(data))
  }

  private codec = JSONCodec()
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
  trigger(p?: Partial<F>, data?: TD): void {
    if (!this.transport)
      throw new Error(`Topic ${this.name} transport is not set, server probably not started`)

    this.transport.publish(this.getTopicName(), p, data)
  }

  // only required fort ServiceImpl to implement Service interfaces
  async get(params?: F): Promise<D> {
    return undefined
  }

  async subscribe(consumer: DataConsumer<D>, params?: F, subscriptionKey?: any): Promise<any> {}

  unsubscribe(params?: F, subscriptionKey?: any) {}
}
