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

export type ServiceItem = Topic<any, any> | RemoteMethod
export type RemoteMethod = (req?, ctx?) => Promise<any>

// client interfaces

export interface ClientTopic<P, D> {
  subscribe(params: P, consumer: DataConsumer<D>, subscriptionKey?: any): void
  unsubscribe(params: P, subscriptionKey?: any)
}

export type DataConsumer<D> = (d: D) => void

// server interfaces
export interface ServerTopicOld<P, D> {
  supply(supplier: DataSupplier<P, D>): void
  trigger(p: P, data?: D): void
}

export type DataSupplier<P, D> = (p: P, ctx) => Promise<D>

export interface ServerTopic<P, D> {
  trigger(p?: P, data?: D): void
}

// common
export interface Topic<P, D> extends ClientTopic<P, D>, ServerTopic<P, D> {
}

export enum MessageType {
  // to server
  Subscribe = 1,       // [1, id, name, params]
  Unsubscribe,    // [2, id, name, params]
  Get,            // [3, id, name, params]
  Call,           // [4, id, name, params]
  // to client
  Data,           // [5, id, name, params, data]
  Result,         // [6, id, res]
  Error,          // [7, id, err]
}

export class TopicImpl<P, D> {
}

// Walk Services object
export function getServiceItem(services: Services, name: string): ServiceItem {
  if (name.startsWith("/")) {
    const names = name.substring(1).split("/")

    const i = services[names[0]]

    if (typeof i == "object") {
      if (i instanceof TopicImpl) return i as any

      return getServiceItem(i as Services, "/" + names.slice(1).join("/"))
    }

    return i
  }

  throw new Error(`Can't lookup topic name ${ name }`)
}