# Interface: RpcServer

## Methods

### close

▸ **close**(`cb`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `cb` | *any* |

**Returns:** *void*

Defined in: [server.ts:57](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L57)

___

### disconnectClient

▸ **disconnectClient**(`remoteId`: *string*): *Promise*<void\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *Promise*<void\>

Defined in: [server.ts:58](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L58)

___

### getConnectedIds

▸ **getConnectedIds**(): *string*[]

**Returns:** *string*[]

Defined in: [server.ts:56](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L56)

___

### getRemote

▸ **getRemote**(`remoteId`: *string*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *any*

Defined in: [server.ts:54](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L54)

___

### isConnected

▸ **isConnected**(`remoteId`: *string*): *boolean*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `remoteId` | *string* |

**Returns:** *boolean*

Defined in: [server.ts:55](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L55)
