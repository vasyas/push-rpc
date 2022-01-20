[@push-rpc/core](../README.md) / RpcClientListeners

# Interface: RpcClientListeners

## Table of contents

### Methods

- [connected](rpcclientlisteners.md#connected)
- [disconnected](rpcclientlisteners.md#disconnected)
- [messageIn](rpcclientlisteners.md#messagein)
- [messageOut](rpcclientlisteners.md#messageout)
- [subscribed](rpcclientlisteners.md#subscribed)
- [unsubscribed](rpcclientlisteners.md#unsubscribed)

## Methods

### connected

▸ **connected**(): *void*

**Returns:** *void*

Defined in: [client.ts:8](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L8)

___

### disconnected

▸ **disconnected**(`__namedParameters`: *Object*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `__namedParameters` | *Object* |

**Returns:** *void*

Defined in: [client.ts:9](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L9)

___

### messageIn

▸ **messageIn**(`data`: *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *string* |

**Returns:** *void*

Defined in: [client.ts:11](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L11)

___

### messageOut

▸ **messageOut**(`data`: *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *string* |

**Returns:** *void*

Defined in: [client.ts:12](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L12)

___

### subscribed

▸ **subscribed**(`subscriptions`: *number*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `subscriptions` | *number* |

**Returns:** *void*

Defined in: [client.ts:13](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L13)

___

### unsubscribed

▸ **unsubscribed**(`subscriptions`: *number*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `subscriptions` | *number* |

**Returns:** *void*

Defined in: [client.ts:14](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/client.ts#L14)
