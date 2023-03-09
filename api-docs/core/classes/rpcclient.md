[@push-rpc/core](../README.md) / RpcClient

# Class: RpcClient<R\>

## Type parameters

| Name |
| :------ |
| `R` |

## Table of contents

### Constructors

- [constructor](rpcclient.md#constructor)

### Properties

- [disconnectedMark](rpcclient.md#disconnectedmark)
- [remote](rpcclient.md#remote)

### Methods

- [connect](rpcclient.md#connect)
- [connectionLoop](rpcclient.md#connectionloop)
- [disconnect](rpcclient.md#disconnect)

## Constructors

### constructor

\+ **new RpcClient**<R\>(`session`: *RpcSession*, `createSocket`: () => *Promise*<[*Socket*](../interfaces/socket.md)\>, `opts`: [*RpcClientOptions*](../interfaces/rpcclientoptions.md)): [*RpcClient*](rpcclient.md)<R\>

#### Type parameters:

| Name |
| :------ |
| `R` |

#### Parameters:

| Name | Type |
| :------ | :------ |
| `session` | *RpcSession* |
| `createSocket` | () => *Promise*<[*Socket*](../interfaces/socket.md)\> |
| `opts` | [*RpcClientOptions*](../interfaces/rpcclientoptions.md) |

**Returns:** [*RpcClient*](rpcclient.md)<R\>

Defined in: [client.ts:60](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L60)

## Properties

### disconnectedMark

• `Private` **disconnectedMark**: *boolean*= false

Defined in: [client.ts:70](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L70)

___

### remote

• **remote**: R

Defined in: [client.ts:60](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L60)

## Methods

### connect

▸ **connect**(`onDisconnected?`: () => *void*): *Promise*<void\>

Connect this to server

Resolves on successful connection, rejects on connection error or connection timeout (10s)

#### Parameters:

| Name | Type |
| :------ | :------ |
| `onDisconnected` | () => *void* |

**Returns:** *Promise*<void\>

Defined in: [client.ts:82](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L82)

___

### connectionLoop

▸ **connectionLoop**(): *Promise*<unknown\>

Connect to the server, on each disconnect try to disconnect.
Resolves at first successful connect. Reconnection loop continues even after resolution
Never rejects

**Returns:** *Promise*<unknown\>

Defined in: [client.ts:137](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L137)

___

### disconnect

▸ **disconnect**(): *Promise*<void\>

**Returns:** *Promise*<void\>

Defined in: [client.ts:72](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/client.ts#L72)
