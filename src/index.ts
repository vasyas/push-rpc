import {ServicesClient} from "./client/remote"

import type {Services} from "./rpc.js"
import type {ServicesImplementation} from "./server/implementation.js"

export {Services}

export type {
  RemoteFunction,
  Consumer,
  RpcContext,
  RpcConnectionContext,
  PING_MSG,
  PONG_MSG,
} from "./rpc.js"
export {RpcError, RpcErrors, CallOptions} from "./rpc.js"

export type {Middleware} from "./utils/middleware.js"
export {withMiddlewares} from "./utils/middleware.js"

export type {RpcServer, PublishServicesOptions} from "./server/index.js"
export type {HttpServerHooks} from "./server/http.js"
export {publishServices} from "./server/index.js"

export type {
  FunctionImplementation,
  ThrottleSettings,
  SubscribeEvent,
  UnsubscribeEvent,
} from "./server/implementation.js"

export {ServicesImplementation}

export type {RpcClient, ConsumeServicesOptions, ClientCache} from "./client/index.js"
export {consumeServices} from "./client/index.js"

export type {ServicesClient, FunctionClient, AddParameters} from "./client/remote.js"

export {log, setLogger} from "./logger.js"
export {safeStringify, safeParseJson} from "./utils/json.js"
export type {ExtractPromiseResult} from "./utils/types.js"

export type UnifiedServices<T extends Services<T>> = ServicesImplementation<T> & ServicesClient<T>
