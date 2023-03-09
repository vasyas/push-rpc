[@push-rpc/core](../README.md) / RpcClientOptions

# Interface: RpcClientOptions

## Table of contents

### Properties

- [callTimeout](rpcclientoptions.md#calltimeout)
- [delayCalls](rpcclientoptions.md#delaycalls)
- [errorDelayMaxDuration](rpcclientoptions.md#errordelaymaxduration)
- [keepAliveTimeout](rpcclientoptions.md#keepalivetimeout)
- [listeners](rpcclientoptions.md#listeners)
- [local](rpcclientoptions.md#local)
- [localMiddleware](rpcclientoptions.md#localmiddleware)
- [pingSendTimeout](rpcclientoptions.md#pingsendtimeout)
- [reconnect](rpcclientoptions.md#reconnect)
- [reconnectDelay](rpcclientoptions.md#reconnectdelay)
- [remoteMiddleware](rpcclientoptions.md#remotemiddleware)
- [syncRemoteCalls](rpcclientoptions.md#syncremotecalls)

### Methods

- [createContext](rpcclientoptions.md#createcontext)
- [messageParser](rpcclientoptions.md#messageparser)

## Properties

### callTimeout

• **callTimeout**: *number*

Defined in: [client.ts:29](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L29)

___

### delayCalls

• **delayCalls**: *number*

Defined in: [client.ts:31](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L31)

___

### errorDelayMaxDuration

• **errorDelayMaxDuration**: *number*

Defined in: [client.ts:22](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L22)

___

### keepAliveTimeout

• **keepAliveTimeout**: *number*

Defined in: [client.ts:28](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L28)

___

### listeners

• **listeners**: [*RpcClientListeners*](rpcclientlisteners.md)

Defined in: [client.ts:19](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L19)

___

### local

• **local**: *any*

Defined in: [client.ts:18](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L18)

___

### localMiddleware

• **localMiddleware**: [*Middleware*](../README.md#middleware)

Defined in: [client.ts:24](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L24)

___

### pingSendTimeout

• **pingSendTimeout**: *number*

Defined in: [client.ts:27](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L27)

___

### reconnect

• **reconnect**: *boolean*

Defined in: [client.ts:20](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L20)

___

### reconnectDelay

• **reconnectDelay**: *number*

Defined in: [client.ts:21](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L21)

___

### remoteMiddleware

• **remoteMiddleware**: [*Middleware*](../README.md#middleware)

Defined in: [client.ts:25](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L25)

___

### syncRemoteCalls

• **syncRemoteCalls**: *boolean*

Defined in: [client.ts:30](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L30)

## Methods

### createContext

▸ **createContext**(): [*RpcConnectionContext*](rpcconnectioncontext.md)<any\>

**Returns:** [*RpcConnectionContext*](rpcconnectioncontext.md)<any\>

Defined in: [client.ts:23](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L23)

___

### messageParser

▸ **messageParser**(`data`: *any*): *any*[]

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *any* |

**Returns:** *any*[]

Defined in: [client.ts:26](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L26)
