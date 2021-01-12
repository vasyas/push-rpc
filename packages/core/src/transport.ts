import {DataFilter} from "./topic"

export type HandleCall = (
  itemName: string,
  body: any,
  respondSuccess: (body: any) => void,
  respondError: (body: any) => void
) => void

export interface Transport {
  // for servers
  publish(topicName: string, filter: DataFilter, data: any)
  listenCalls(handle: HandleCall)

  // for clients
  call(itemName: string, requestBody: DataFilter): Promise<any>
  subscribeTopic(topicName: string, filter: DataFilter, handle: (d: any) => void): TopicSubscription
}

export interface TopicSubscription {
  unsubscribe(): void
}
