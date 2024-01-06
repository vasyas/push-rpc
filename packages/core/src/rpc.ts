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

export function getServiceItem(services: Services, name: string): {item: ServiceItem; object: any} {
  const names = name.split("/")

  const item = services[names[0]]

  if (!item) {
    return {item: null, object: null}
  }

  if (names.length == 1) {
    if (item) {
      return {item: item as any, object: services}
    } else {
      return {item: null, object: null}
    }
  }

  return getServiceItem(item as Services, names.slice(1).join("/"))
}

// remote interfaces

export interface RemoteTopic<D, P> {
  subscribe(
    consumer: DataConsumer<D>,
    params?: P,
    subscriptionKey?: any,
    callOpts?: CallOptions
  ): Promise<any>
  unsubscribe(params?: P, subscriptionKey?: any)
  get(params?: P, callOpts?: CallOptions): Promise<D>
}

export interface CallOptions {
  timeout?: number
}

export type DataConsumer<D> = (d: D) => void

// local interfaces
export type DataSupplier<D, P> = (p: P, ctx) => Promise<D>

export interface LocalTopic<D, P, TD = D> {
  trigger(p?: Partial<P>, data?: TD): void
  getData(filter: P, callContext: unknown, connectionContext?: unknown): Promise<D>
}

export interface RpcConnectionContext<Remote = any> {
  [prop: string]: unknown
  remoteId: string
  protocol?: string
}

// used in calls
export interface RpcContext<Remote = any> extends RpcConnectionContext<Remote> {
  remote: Remote

  item: ServiceItem
  messageId?: string
  itemName?: string
}

export interface Topic<D, P = {}, TD = D> extends RemoteTopic<D, P>, LocalTopic<D, P, TD> {}

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

// Middleware - an local or remote call interceptor
// ctx would be null for remote interceptors
export type Middleware = (
  ctx: any,
  next: (params: any) => Promise<any>,
  params: any,
  messageType: MessageType.Call | MessageType.Get | MessageType.Subscribe
) => Promise<any>

// id generator
