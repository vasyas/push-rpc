[@push-rpc/core](../README.md) / RpcClientOptions

# Interface: RpcClientOptions

## Table of contents

### Properties

- [callTimeout](rpcclientoptions.md#calltimeout)
- [keepAliveTimeout](rpcclientoptions.md#keepalivetimeout)
- [listeners](rpcclientoptions.md#listeners)
- [local](rpcclientoptions.md#local)
- [localMiddleware](rpcclientoptions.md#localmiddleware)
- [pingSendTimeout](rpcclientoptions.md#pingsendtimeout)
- [reconnect](rpcclientoptions.md#reconnect)
- [remoteMiddleware](rpcclientoptions.md#remotemiddleware)
- [syncRemoteCalls](rpcclientoptions.md#syncremotecalls)

### Methods

- [createContext](rpcclientoptions.md#createcontext)
- [messageParser](rpcclientoptions.md#messageparser)

## Properties

### callTimeout

• **callTimeout**: *number*

Defined in: [client.ts:32](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L32)

___

### keepAliveTimeout

• **keepAliveTimeout**: *number*

Defined in: [client.ts:31](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L31)

___

### listeners

• **listeners**: [*RpcClientListeners*](rpcclientlisteners.md)

Defined in: [client.ts:24](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L24)

___

### local

• **local**: *any*

Defined in: [client.ts:23](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L23)

___

### localMiddleware

• **localMiddleware**: [*Middleware*](../README.md#middleware)

Defined in: [client.ts:27](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L27)

___

### pingSendTimeout

• **pingSendTimeout**: *number*

Defined in: [client.ts:30](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L30)

___

### reconnect

• **reconnect**: *boolean*

Defined in: [client.ts:25](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L25)

___

### remoteMiddleware

• **remoteMiddleware**: [*Middleware*](../README.md#middleware)

Defined in: [client.ts:28](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L28)

___

### syncRemoteCalls

• **syncRemoteCalls**: *boolean*

Defined in: [client.ts:33](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L33)

## Methods

### createContext

▸ **createContext**(): [*RpcConnectionContext*](rpcconnectioncontext.md)<any\>

**Returns:** [*RpcConnectionContext*](rpcconnectioncontext.md)<any\>

Defined in: [client.ts:26](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L26)

___

### messageParser

▸ **messageParser**(`data`: *any*): *any*[]

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *any* |

**Returns:** *any*[]

Defined in: [client.ts:29](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/core/src/client.ts#L29)
