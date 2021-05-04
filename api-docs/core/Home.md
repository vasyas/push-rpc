# @push-rpc/core

## Table of contents

### Enumerations

- [MessageType](../wiki/Enum:%20MessageType)

### Classes

- [LocalTopicImpl](../wiki/Class:%20LocalTopicImpl)

### Interfaces

- [LocalTopic](../wiki/Interface:%20LocalTopic)
- [RemoteTopic](../wiki/Interface:%20RemoteTopic)
- [RpcClient](../wiki/Interface:%20RpcClient)
- [RpcClientListeners](../wiki/Interface:%20RpcClientListeners)
- [RpcClientOptions](../wiki/Interface:%20RpcClientOptions)
- [RpcConnectionContext](../wiki/Interface:%20RpcConnectionContext)
- [RpcContext](../wiki/Interface:%20RpcContext)
- [RpcServer](../wiki/Interface:%20RpcServer)
- [RpcServerOptions](../wiki/Interface:%20RpcServerOptions)
- [Socket](../wiki/Interface:%20Socket)
- [SocketServer](../wiki/Interface:%20SocketServer)
- [Topic](../wiki/Interface:%20Topic)

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

Defined in: [rpc.ts:48](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L48)

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

Defined in: [rpc.ts:51](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L51)

___

### Middleware

Ƭ **Middleware**: (`ctx`: *any*, `next`: (`params`: *any*) => *Promise*<any\>, `params`: *any*, `messageType`: [*Call*](../wiki/Enum:%20MessageType#call) \| [*Get*](../wiki/Enum:%20MessageType#get) \| [*Subscribe*](../wiki/Enum:%20MessageType#subscribe)) => *Promise*<any\>

#### Type declaration:

▸ (`ctx`: *any*, `next`: (`params`: *any*) => *Promise*<any\>, `params`: *any*, `messageType`: [*Call*](../wiki/Enum:%20MessageType#call) \| [*Get*](../wiki/Enum:%20MessageType#get) \| [*Subscribe*](../wiki/Enum:%20MessageType#subscribe)): *Promise*<any\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `ctx` | *any* |
| `next` | (`params`: *any*) => *Promise*<any\> |
| `params` | *any* |
| `messageType` | [*Call*](../wiki/Enum:%20MessageType#call) \| [*Get*](../wiki/Enum:%20MessageType#get) \| [*Subscribe*](../wiki/Enum:%20MessageType#subscribe) |

**Returns:** *Promise*<any\>

Defined in: [rpc.ts:91](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L91)

## Variables

### PING\_MESSAGE

• `Const` **PING\_MESSAGE**: ``"PING"``= "PING"

Defined in: [RpcSession.ts:429](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/RpcSession.ts#L429)

___

### PONG\_MESSAGE

• `Const` **PONG\_MESSAGE**: ``"PONG"``= "PONG"

Defined in: [RpcSession.ts:430](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/RpcSession.ts#L430)

## Functions

### composeMiddleware

▸ **composeMiddleware**(...`middleware`: [*Middleware*](../wiki/Home#middleware)[]): [*Middleware*](../wiki/Home#middleware)

#### Parameters:

| Name | Type |
| :------ | :------ |
| `...middleware` | [*Middleware*](../wiki/Home#middleware)[] |

**Returns:** [*Middleware*](../wiki/Home#middleware)

Defined in: [utils.ts:76](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L76)

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

Defined in: [utils.ts:123](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L123)

___

### createMessageId

▸ `Let`**createMessageId**(): *any*

**Returns:** *any*

Defined in: [utils.ts:58](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L58)

___

### createRpcClient

▸ **createRpcClient**<R\>(`level`: *any*, `createSocket`: () => [*Socket*](../wiki/Interface:%20Socket), `options?`: *Partial*<[*RpcClientOptions*](../wiki/Interface:%20RpcClientOptions)\>): *Promise*<[*RpcClient*](../wiki/Interface:%20RpcClient)<R\>\>

#### Type parameters:

| Name | Default |
| :------ | :------ |
| `R` | *any* |

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `level` | *any* | - |
| `createSocket` | () => [*Socket*](../wiki/Interface:%20Socket) | - |
| `options` | *Partial*<[*RpcClientOptions*](../wiki/Interface:%20RpcClientOptions)\> | {} |

**Returns:** *Promise*<[*RpcClient*](../wiki/Interface:%20RpcClient)<R\>\>

Defined in: [client.ts:58](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/client.ts#L58)

___

### createRpcServer

▸ **createRpcServer**(`local`: *any*, `socketServer`: [*SocketServer*](../wiki/Interface:%20SocketServer), `opts?`: [*RpcServerOptions*](../wiki/Interface:%20RpcServerOptions)): [*RpcServer*](../wiki/Interface:%20RpcServer)

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `local` | *any* | - |
| `socketServer` | [*SocketServer*](../wiki/Interface:%20SocketServer) | - |
| `opts` | [*RpcServerOptions*](../wiki/Interface:%20RpcServerOptions) | {} |

**Returns:** [*RpcServer*](../wiki/Interface:%20RpcServer)

Defined in: [server.ts:61](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L61)

___

### dateReviver

▸ **dateReviver**(`key`: *any*, `val`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `key` | *any* |
| `val` | *any* |

**Returns:** *any*

Defined in: [utils.ts:5](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L5)

___

### mapTopic

▸ **mapTopic**<D1, P, D2\>(`t`: [*RemoteTopic*](../wiki/Interface:%20RemoteTopic)<D1, P\>, `map`: (`D1`: *any*) => D2): [*RemoteTopic*](../wiki/Interface:%20RemoteTopic)<D2, P\>

#### Type parameters:

| Name |
| :------ |
| `D1` |
| `P` |
| `D2` |

#### Parameters:

| Name | Type |
| :------ | :------ |
| `t` | [*RemoteTopic*](../wiki/Interface:%20RemoteTopic)<D1, P\> |
| `map` | (`D1`: *any*) => D2 |

**Returns:** [*RemoteTopic*](../wiki/Interface:%20RemoteTopic)<D2, P\>

Defined in: [utils.ts:99](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L99)

___

### setCreateMessageId

▸ **setCreateMessageId**(`f`: () => *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `f` | () => *string* |

**Returns:** *void*

Defined in: [utils.ts:60](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/utils.ts#L60)

___

### setLogger

▸ **setLogger**(`l`: Logger): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `l` | Logger |

**Returns:** *void*

Defined in: [logger.ts:10](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/logger.ts#L10)
