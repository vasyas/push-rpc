import {DataConsumer, DataSupplier, LocalTopic, RemoteTopic, Topic} from "../../core/src"

export {DataSupplier, DataConsumer, LocalTopic, RemoteTopic, Topic}

export type Method = (req?, ctx?) => Promise<any>
export type ServiceItem =
  | {method: Method; object: any}
  | {topic: LocalTopic<never, never>; object: any}

export type HandleCall = (itemName: string, body: any, respond) => void

export const ITEM_NAME_SEPARATOR = "/"

export interface Transport {
  // for servers
  publish<F, D>(topicName: string, filter: F, data: D)
  listenCalls(handle: HandleCall)

  // for clients

  call<F, D>(itemName: string, requestBody: F): Promise<D>
  subscribeTopic<F>(topicName: string, filter: F, handle: (d: any) => void): TopicSubscription
}

export interface TopicSubscription {
  unsubscribe(): void
}
