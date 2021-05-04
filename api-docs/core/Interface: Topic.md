# Interface: Topic<D, P, TD\>

## Type parameters

| Name | Default |
| :------ | :------ |
| `D` | - |
| `P` | {} |
| `TD` | D |

## Hierarchy

* [*RemoteTopic*](../wiki/Interface:%20RemoteTopic)<D, P\>

* [*LocalTopic*](../wiki/Interface:%20LocalTopic)<D, P, TD\>

  ↳ **Topic**

## Implemented by

* [*LocalTopicImpl*](../wiki/Class:%20LocalTopicImpl)

## Methods

### get

▸ **get**(`params?`: P): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |

**Returns:** *Promise*<D\>

Inherited from: [RemoteTopic](../wiki/Interface:%20RemoteTopic)

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

Inherited from: [RemoteTopic](../wiki/Interface:%20RemoteTopic)

Defined in: [rpc.ts:43](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L43)

___

### trigger

▸ **trigger**(`p?`: *Partial*<P\>, `data?`: TD): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `p?` | *Partial*<P\> |
| `data?` | TD |

**Returns:** *void*

Inherited from: [LocalTopic](../wiki/Interface:%20LocalTopic)

Defined in: [rpc.ts:54](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L54)

___

### unsubscribe

▸ **unsubscribe**(`params?`: P, `subscriptionKey?`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *any*

Inherited from: [RemoteTopic](../wiki/Interface:%20RemoteTopic)

Defined in: [rpc.ts:44](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/rpc.ts#L44)
