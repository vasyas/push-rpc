[@push-rpc/core](../README.md) / Topic

# Interface: Topic<D, P, TD\>

## Type parameters

| Name | Default |
| :------ | :------ |
| `D` | - |
| `P` | {} |
| `TD` | D |

## Hierarchy

* [*RemoteTopic*](remotetopic.md)<D, P\>

* [*LocalTopic*](localtopic.md)<D, P, TD\>

  ↳ **Topic**

## Implemented by

* [*LocalTopicImpl*](../classes/localtopicimpl.md)

## Table of contents

### Methods

- [get](topic.md#get)
- [subscribe](topic.md#subscribe)
- [trigger](topic.md#trigger)
- [unsubscribe](topic.md#unsubscribe)

## Methods

### get

▸ **get**(`params?`: P): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |

**Returns:** *Promise*<D\>

Inherited from: [RemoteTopic](remotetopic.md)

Defined in: [rpc.ts:45](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L45)

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

Inherited from: [RemoteTopic](remotetopic.md)

Defined in: [rpc.ts:43](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L43)

___

### trigger

▸ **trigger**(`p?`: *Partial*<P\>, `data?`: TD): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `p?` | *Partial*<P\> |
| `data?` | TD |

**Returns:** *void*

Inherited from: [LocalTopic](localtopic.md)

Defined in: [rpc.ts:54](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L54)

___

### unsubscribe

▸ **unsubscribe**(`params?`: P, `subscriptionKey?`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | P |
| `subscriptionKey?` | *any* |

**Returns:** *any*

Inherited from: [RemoteTopic](remotetopic.md)

Defined in: [rpc.ts:44](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L44)
