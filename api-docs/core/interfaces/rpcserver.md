[@push-rpc/core](../README.md) / RpcServer

# Interface: RpcServer

## Table of contents

### Methods

- [close](rpcserver.md#close)
- [disconnectClient](rpcserver.md#disconnectclient)
- [getConnectedIds](rpcserver.md#getconnectedids)
- [getRemote](rpcserver.md#getremote)
- [isConnected](rpcserver.md#isconnected)

## Methods

### close

▸ **close**(`cb`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `cb` | *any* |

**Returns:** *void*

Defined in: [server.ts:59](https://github.com/vasyas/typescript-rpc/blob/567818c/packages/core/src/server.ts#L59)

___

### disconnectClient

▸ **disconnectClient**(`remoteId`: *string*): *Promise*<void\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *Promise*<void\>

Defined in: [server.ts:60](https://github.com/vasyas/typescript-rpc/blob/567818c/packages/core/src/server.ts#L60)

___

### getConnectedIds

▸ **getConnectedIds**(): *string*[]

**Returns:** *string*[]

Defined in: [server.ts:58](https://github.com/vasyas/typescript-rpc/blob/567818c/packages/core/src/server.ts#L58)

___

### getRemote

▸ **getRemote**(`remoteId`: *string*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *any*

Defined in: [server.ts:56](https://github.com/vasyas/typescript-rpc/blob/567818c/packages/core/src/server.ts#L56)

___

### isConnected

▸ **isConnected**(`remoteId`: *string*): *boolean*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *boolean*

Defined in: [server.ts:57](https://github.com/vasyas/typescript-rpc/blob/567818c/packages/core/src/server.ts#L57)
