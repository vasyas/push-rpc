# @push-rpc/tcp

## Functions

### createSocket

▸ **createSocket**(`host`: *any*, `port`: *any*): Socket

#### Parameters:

| Name | Type |
| :------ | :------ |
| `host` | *any* |
| `port` | *any* |

**Returns:** Socket

Defined in: [client.ts:4](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/tcp/src/client.ts#L4)

___

### createSocketServer

▸ **createSocketServer**(`port`: *any*): SocketServer

#### Parameters:

| Name | Type |
| :------ | :------ |
| `port` | *any* |

**Returns:** SocketServer

Defined in: [server.ts:5](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/tcp/src/server.ts#L5)

___

### wrapSocket

▸ **wrapSocket**(`socket`: net.Socket): Socket

#### Parameters:

| Name | Type |
| :------ | :------ |
| `socket` | net.Socket |

**Returns:** Socket

Defined in: [client.ts:11](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/tcp/src/client.ts#L11)
