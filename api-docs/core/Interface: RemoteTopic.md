# Interface: RemoteTopic<D, P\>

## Type parameters

| Name |
| :------ |
| `D` |
| `P` |

## Hierarchy

* **RemoteTopic**

  ↳ [*Topic*](../wiki/Interface:%20Topic)

## Methods

### get

▸ **get**(`params?`: P): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |

**Returns:** *Promise*<D\>

Defined in: [rpc.ts:45](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L45)

___

### subscribe

▸ **subscribe**(`consumer`: [*DataConsumer*](../wiki/Home#dataconsumer)<D\>, `params?`: P, `subscriptionKey?`: *any*): *Promise*<any\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `consumer` | [*DataConsumer*](../wiki/Home#dataconsumer)<D\> |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *Promise*<any\>

Defined in: [rpc.ts:43](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L43)

___

### unsubscribe

▸ **unsubscribe**(`params?`: P, `subscriptionKey?`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *any*

Defined in: [rpc.ts:44](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L44)
