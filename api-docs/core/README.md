@push-rpc/core

# @push-rpc/core

## Table of contents

### Enumerations

- [MessageType](enums/messagetype.md)

### Classes

- [LocalTopicImpl](classes/localtopicimpl.md)
- [RpcClient](classes/rpcclient.md)

### Interfaces

- [LocalTopic](interfaces/localtopic.md)
- [RemoteTopic](interfaces/remotetopic.md)
- [RpcClientListeners](interfaces/rpcclientlisteners.md)
- [RpcClientOptions](interfaces/rpcclientoptions.md)
- [RpcConnectionContext](interfaces/rpcconnectioncontext.md)
- [RpcContext](interfaces/rpccontext.md)
- [RpcServer](interfaces/rpcserver.md)
- [RpcServerOptions](interfaces/rpcserveroptions.md)
- [Socket](interfaces/socket.md)
- [SocketServer](interfaces/socketserver.md)
- [Topic](interfaces/topic.md)

### Type aliases

- [DataConsumer](README.md#dataconsumer)
- [DataSupplier](README.md#datasupplier)
- [Middleware](README.md#middleware)

### Variables

- [PING\_MESSAGE](README.md#ping_message)
- [PONG\_MESSAGE](README.md#pong_message)

### Functions

- [composeMiddleware](README.md#composemiddleware)
- [createDomWebsocket](README.md#createdomwebsocket)
- [createMessageId](README.md#createmessageid)
- [createRpcClient](README.md#createrpcclient)
- [createRpcServer](README.md#createrpcserver)
- [dateReviver](README.md#datereviver)
- [mapTopic](README.md#maptopic)
- [setCreateMessageId](README.md#setcreatemessageid)
- [setLogger](README.md#setlogger)

## Type aliases

### DataConsumer

Ƭ **DataConsumer**<D\>: (`d`: D) => *void*

#### Type parameters:

| Name |
| :------ |
| `D` |

#### Type declaration:

▸ (`d`: D): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `d` | D |

**Returns:** *void*

Defined in: [rpc.ts:52](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L52)

___

### DataSupplier

Ƭ **DataSupplier**<D, P\>: (`p`: P, `ctx`: *any*) => *Promise*<D\>

#### Type parameters:

| Name |
| :------ |
| `D` |
| `P` |

#### Type declaration:

▸ (`p`: P, `ctx`: *any*): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `p` | P |
| `ctx` | *any* |

**Returns:** *Promise*<D\>

Defined in: [rpc.ts:55](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L55)

___

### Middleware

Ƭ **Middleware**: (`ctx`: *any*, `next`: (`params`: *any*) => *Promise*<any\>, `params`: *any*, `messageType`: [*Call*](enums/messagetype.md#call) \| [*Get*](enums/messagetype.md#get) \| [*Subscribe*](enums/messagetype.md#subscribe)) => *Promise*<any\>

#### Type declaration:

▸ (`ctx`: *any*, `next`: (`params`: *any*) => *Promise*<any\>, `params`: *any*, `messageType`: [*Call*](enums/messagetype.md#call) \| [*Get*](enums/messagetype.md#get) \| [*Subscribe*](enums/messagetype.md#subscribe)): *Promise*<any\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `ctx` | *any* |
| `next` | (`params`: *any*) => *Promise*<any\> |
| `params` | *any* |
| `messageType` | [*Call*](enums/messagetype.md#call) \| [*Get*](enums/messagetype.md#get) \| [*Subscribe*](enums/messagetype.md#subscribe) |

**Returns:** *Promise*<any\>

Defined in: [rpc.ts:95](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L95)

## Variables

### PING\_MESSAGE

• `Const` **PING\_MESSAGE**: ``"PING"``= "PING"

Defined in: [RpcSession.ts:459](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/RpcSession.ts#L459)

___

### PONG\_MESSAGE

• `Const` **PONG\_MESSAGE**: ``"PONG"``= "PONG"

Defined in: [RpcSession.ts:460](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/RpcSession.ts#L460)

## Functions

### composeMiddleware

▸ **composeMiddleware**(...`middleware`: [*Middleware*](README.md#middleware)[]): [*Middleware*](README.md#middleware)

#### Parameters:

| Name | Type |
| :------ | :------ |
| `...middleware` | [*Middleware*](README.md#middleware)[] |

**Returns:** [*Middleware*](README.md#middleware)

Defined in: [utils.ts:81](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L81)

___

### createDomWebsocket

▸ **createDomWebsocket**(`url`: *any*, `protocols?`: *any*): *object*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `url` | *any* |
| `protocols` | *any* |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `disconnect` | () => *void* |
| `onDisconnected` | (`h`: *any*) => *void* |
| `onError` | (`h`: *any*) => *any* |
| `onMessage` | (`h`: *any*) => *void* |
| `onOpen` | (`h`: *any*) => *any* |
| `onPing` | (`h`: *any*) => *void* |
| `onPong` | (`h`: *any*) => *void* |
| `ping` | () => *void* |
| `send` | (`data`: *any*) => *any* |

Defined in: [utils.ts:128](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L128)

___

### createMessageId

▸ `Let`**createMessageId**(): *any*

**Returns:** *any*

Defined in: [utils.ts:63](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L63)

___

### createRpcClient

▸ **createRpcClient**<R\>(`level`: *any*, `createSocket`: () => *Promise*<[*Socket*](interfaces/socket.md)\>, `options?`: *Partial*<[*RpcClientOptions*](interfaces/rpcclientoptions.md)\>): *Promise*<[*RpcClient*](classes/rpcclient.md)<R\>\>

#### Type parameters:

| Name | Default |
| :------ | :------ |
| `R` | *any* |

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `level` | *any* | - |
| `createSocket` | () => *Promise*<[*Socket*](interfaces/socket.md)\> | - |
| `options` | *Partial*<[*RpcClientOptions*](interfaces/rpcclientoptions.md)\> | {} |

**Returns:** *Promise*<[*RpcClient*](classes/rpcclient.md)<R\>\>

Defined in: [client.ts:178](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L178)

___

### createRpcServer

▸ **createRpcServer**(`local`: *any*, `socketServer`: [*SocketServer*](interfaces/socketserver.md), `opts?`: [*RpcServerOptions*](interfaces/rpcserveroptions.md)): [*RpcServer*](interfaces/rpcserver.md)

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `local` | *any* | - |
| `socketServer` | [*SocketServer*](interfaces/socketserver.md) | - |
| `opts` | [*RpcServerOptions*](interfaces/rpcserveroptions.md) | {} |

**Returns:** [*RpcServer*](interfaces/rpcserver.md)

Defined in: [server.ts:63](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/server.ts#L63)

___

### dateReviver

▸ **dateReviver**(`key`: *any*, `val`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `key` | *any* |
| `val` | *any* |

**Returns:** *any*

Defined in: [utils.ts:6](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L6)

___

### mapTopic

▸ **mapTopic**<D1, P, D2\>(`t`: [*RemoteTopic*](interfaces/remotetopic.md)<D1, P\>, `map`: (`D1`: *any*) => D2): [*RemoteTopic*](interfaces/remotetopic.md)<D2, P\>

#### Type parameters:

| Name |
| :------ |
| `D1` |
| `P` |
| `D2` |

#### Parameters:

| Name | Type |
| :------ | :------ |
| `t` | [*RemoteTopic*](interfaces/remotetopic.md)<D1, P\> |
| `map` | (`D1`: *any*) => D2 |

**Returns:** [*RemoteTopic*](interfaces/remotetopic.md)<D2, P\>

Defined in: [utils.ts:104](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L104)

___

### setCreateMessageId

▸ **setCreateMessageId**(`f`: () => *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `f` | () => *string* |

**Returns:** *void*

Defined in: [utils.ts:65](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/utils.ts#L65)

___

### setLogger

▸ **setLogger**(`l`: Logger): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `l` | Logger |

**Returns:** *void*

Defined in: [logger.ts:10](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/logger.ts#L10)
