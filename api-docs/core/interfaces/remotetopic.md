[@push-rpc/core](../README.md) / RemoteTopic

# Interface: RemoteTopic<D, P\>

## Type parameters

| Name |
| :------ |
| `D` |
| `P` |

## Hierarchy

* **RemoteTopic**

  ↳ [*Topic*](topic.md)

## Table of contents

### Methods

- [get](remotetopic.md#get)
- [subscribe](remotetopic.md#subscribe)
- [unsubscribe](remotetopic.md#unsubscribe)

## Methods

### get

▸ **get**(`params?`: P): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |

**Returns:** *Promise*<D\>

Defined in: [rpc.ts:45](https://github.com/vasyas/typescript-rpc/blob/4c1eb2a/packages/core/src/rpc.ts#L45)

___

### subscribe

▸ **subscribe**(`consumer`: [*DataConsumer*](../README.md#dataconsumer)<D\>, `params?`: P, `subscriptionKey?`: *any*): *Promise*<any\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `consumer` | [*DataConsumer*](../README.md#dataconsumer)<D\> |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *Promise*<any\>

Defined in: [rpc.ts:43](https://github.com/vasyas/typescript-rpc/blob/4c1eb2a/packages/core/src/rpc.ts#L43)

___

### unsubscribe

▸ **unsubscribe**(`params?`: P, `subscriptionKey?`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *any*

Defined in: [rpc.ts:44](https://github.com/vasyas/typescript-rpc/blob/4c1eb2a/packages/core/src/rpc.ts#L44)
