[@push-rpc/core](../README.md) / Socket

# Interface: Socket

## Table of contents

### Methods

- [disconnect](socket.md#disconnect)
- [onDisconnected](socket.md#ondisconnected)
- [onError](socket.md#onerror)
- [onMessage](socket.md#onmessage)
- [onOpen](socket.md#onopen)
- [onPing](socket.md#onping)
- [onPong](socket.md#onpong)
- [ping](socket.md#ping)
- [send](socket.md#send)

## Methods

### disconnect

▸ **disconnect**(): *any*

**Returns:** *any*

Defined in: [transport.ts:7](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L7)

___

### onDisconnected

▸ **onDisconnected**(`h`: (`code`: *any*, `reason`: *any*) => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`code`: *any*, `reason`: *any*) => *void* |

**Returns:** *any*

Defined in: [transport.ts:8](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L8)

___

### onError

▸ **onError**(`h`: (`e`: *any*) => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`e`: *any*) => *void* |

**Returns:** *any*

Defined in: [transport.ts:3](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L3)

___

### onMessage

▸ **onMessage**(`h`: (`message`: *string*) => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | (`message`: *string*) => *void* |

**Returns:** *any*

Defined in: [transport.ts:11](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L11)

___

### onOpen

▸ **onOpen**(`h`: () => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | () => *void* |

**Returns:** *any*

Defined in: [transport.ts:2](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L2)

___

### onPing

▸ **onPing**(`h`: () => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | () => *void* |

**Returns:** *any*

Defined in: [transport.ts:5](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L5)

___

### onPong

▸ **onPong**(`h`: () => *void*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `h` | () => *void* |

**Returns:** *any*

Defined in: [transport.ts:4](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L4)

___

### ping

▸ **ping**(`data`: *string*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *string* |

**Returns:** *any*

Defined in: [transport.ts:12](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L12)

___

### send

▸ **send**(`data`: *string*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *string* |

**Returns:** *any*

Defined in: [transport.ts:10](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/core/src/transport.ts#L10)
