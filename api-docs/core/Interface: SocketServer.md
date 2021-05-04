# Interface: SocketServer

## Methods

### close

▸ **close**(`cb`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `cb` | *any* |

**Returns:** *void*

Defined in: [transport.ts:21](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/transport.ts#L21)

___

### onConnection

▸ **onConnection**(`h`: (`socket`: [*Socket*](../wiki/Interface:%20Socket), ...`transportDetails`: *any*) => *Promise*<void\>, `isConnected`: (`remoteId`: *string*) => *boolean*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`socket`: [*Socket*](../wiki/Interface:%20Socket), ...`transportDetails`: *any*) => *Promise*<void\> |
| `isConnected` | (`remoteId`: *string*) => *boolean* |

**Returns:** *void*

Defined in: [transport.ts:17](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/transport.ts#L17)

___

### onError

▸ **onError**(`h`: (`e`: *any*) => *void*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`e`: *any*) => *void* |

**Returns:** *void*

Defined in: [transport.ts:16](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/transport.ts#L16)
