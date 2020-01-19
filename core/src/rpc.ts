/**
 * Each Service interface could be remote called.
 * Each Service member should be either Topic or method
 *
 * NOTE Do not extends this method, it is for reference only
 */
export interface Service {
  [name: string]: ServiceItem
}

export interface Services {
  [name: string]: Service | Services
}

export type ServiceItem = Topic<any, any> | Method
export type Method = (req?, ctx?) => Promise<any>

export function getServiceItem(services: Services, name: string): ServiceItem {
  if (!name) {
    throw new Error(`Can't lookup service item ${name}`)
  }

  const names = name.split("/")

  const i = services[names[0]]

  if (typeof i == "object") {
    if (i instanceof TopicImpl) return i as any

    if (!i) {
      throw new Error(`Can't lookup service item ${name}`)
    }

    return getServiceItem(i as Services, names.slice(1).join("/"))
  }

  return i
}

// remote interfaces

export interface RemoteTopic<D, P> {
  subscribe(consumer: DataConsumer<D>, params?: P, subscriptionKey?: any): void
  unsubscribe(params?: P, subscriptionKey?: any)
  get(params?: P): Promise<D>
}

export type DataConsumer<D> = (d: D) => void

// local interfaces
export type DataSupplier<D, P> = (p: P, ctx) => Promise<D>

export interface LocalTopic<D, P> {
  trigger(p?: P, data?: D): void
}

export interface RpcConnectionContext<Remote = any> {
  [prop: string]: unknown
  remoteId: string
  protocol?: string
}

// used in calls
export interface RpcContext<Remote = any> extends RpcConnectionContext<Remote> {
  remote: Remote

  messageId?: string
  itemName?: string
}

export interface Topic<D, P = {}> extends RemoteTopic<D, P>, LocalTopic<D, P> {}

export enum MessageType {
  // Requests
  Call = 2, // [2, id, name, params]
  Subscribe = 11, // [11, id, name, params]
  Unsubscribe = 12, // [12, id, name, params]
  Get = 14, // [14, id, name, params]

  // Responses
  Result = 3, // [3, id, res]
  Error = 4, // [4, id, code, description, details]
  Data = 13, // [13, id, name, params, data]
}

export class TopicImpl {}
