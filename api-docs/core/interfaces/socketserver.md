[@push-rpc/core](../README.md) / SocketServer

# Interface: SocketServer

## Table of contents

### Methods

- [close](socketserver.md#close)
- [onConnection](socketserver.md#onconnection)
- [onError](socketserver.md#onerror)

## Methods

### close

▸ **close**(`cb`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `cb` | *any* |

**Returns:** *void*

Defined in: [transport.ts:21](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/transport.ts#L21)

___

### onConnection

▸ **onConnection**(`h`: (`socket`: [*Socket*](socket.md), ...`transportDetails`: *any*) => *Promise*<void\>, `isConnected`: (`remoteId`: *string*) => *boolean*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`socket`: [*Socket*](socket.md), ...`transportDetails`: *any*) => *Promise*<void\> |
| `isConnected` | (`remoteId`: *string*) => *boolean* |

**Returns:** *void*

Defined in: [transport.ts:17](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/transport.ts#L17)

___

### onError

▸ **onError**(`h`: (`e`: *any*) => *void*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`e`: *any*) => *void* |

**Returns:** *void*

Defined in: [transport.ts:16](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/transport.ts#L16)
