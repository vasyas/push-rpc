[@push-rpc/core](../README.md) / LocalTopicImpl

# Class: LocalTopicImpl<D, F, TD\>

LocalTopicImpl should implement Topic (and RemoteTopic) so it could be used in ServiceImpl

## Type parameters

| Name | Default |
| :------ | :------ |
| `D` | - |
| `F` | - |
| `TD` | D |

## Hierarchy

* *TopicImpl*

  ↳ **LocalTopicImpl**

## Implements

* [*Topic*](../interfaces/topic.md)<D, F, TD\>

## Table of contents

### Constructors

- [constructor](localtopicimpl.md#constructor)

### Properties

- [dataSupplierCache](localtopicimpl.md#datasuppliercache)
- [name](localtopicimpl.md#name)
- [subscriptions](localtopicimpl.md#subscriptions)

### Methods

- [get](localtopicimpl.md#get)
- [getData](localtopicimpl.md#getdata)
- [getTopicName](localtopicimpl.md#gettopicname)
- [isSubscribed](localtopicimpl.md#issubscribed)
- [setTopicName](localtopicimpl.md#settopicname)
- [subscribe](localtopicimpl.md#subscribe)
- [subscribeSession](localtopicimpl.md#subscribesession)
- [throttled](localtopicimpl.md#throttled)
- [trigger](localtopicimpl.md#trigger)
- [unsubscribe](localtopicimpl.md#unsubscribe)
- [unsubscribeSession](localtopicimpl.md#unsubscribesession)

## Constructors

### constructor

\+ **new LocalTopicImpl**<D, F, TD\>(`supplier`: [*DataSupplier*](../README.md#datasupplier)<D, F\>, `opts?`: *Partial*<LocalTopicImplOpts<D, F, TD\>\>): [*LocalTopicImpl*](localtopicimpl.md)<D, F, TD\>

#### Type parameters:

| Name | Default |
| :------ | :------ |
| `D` | - |
| `F` | - |
| `TD` | D |

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `supplier` | [*DataSupplier*](../README.md#datasupplier)<D, F\> | - |
| `opts` | *Partial*<LocalTopicImplOpts<D, F, TD\>\> | {} |

**Returns:** [*LocalTopicImpl*](localtopicimpl.md)<D, F, TD\>

Overrides: TopicImpl.constructor

Defined in: [local.ts:21](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L21)

## Properties

### dataSupplierCache

• `Private` **dataSupplierCache**: *PromiseCache*<F, D\>

Defined in: [local.ts:53](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L53)

___

### name

• `Private` **name**: *string*

Defined in: [local.ts:35](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L35)

___

### subscriptions

• `Protected` **subscriptions**: *object*= {}

#### Type declaration:

Defined in: [local.ts:110](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L110)

## Methods

### get

▸ **get**(`params?`: F): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | F |

**Returns:** *Promise*<D\>

Implementation of: [Topic](../interfaces/topic.md)

Defined in: [local.ts:118](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L118)

___

### getData

▸ **getData**(`filter`: F, `callContext`: *unknown*, `connectionContext`: *unknown*): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `filter` | F |
| `callContext` | *unknown* |
| `connectionContext` | *unknown* |

**Returns:** *Promise*<D\>

Defined in: [local.ts:55](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L55)

___

### getTopicName

▸ **getTopicName**(): *string*

**Returns:** *string*

Defined in: [local.ts:37](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L37)

___

### isSubscribed

▸ **isSubscribed**(): *boolean*

**Returns:** *boolean*

Defined in: [local.ts:112](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L112)

___

### setTopicName

▸ **setTopicName**(`s`: *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `s` | *string* |

**Returns:** *void*

Defined in: [local.ts:41](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L41)

___

### subscribe

▸ **subscribe**(`consumer`: [*DataConsumer*](../README.md#dataconsumer)<D\>, `params`: F, `subscriptionKey`: *any*): *Promise*<void\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `consumer` | [*DataConsumer*](../README.md#dataconsumer)<D\> |
| `params` | F |
| `subscriptionKey` | *any* |

**Returns:** *Promise*<void\>

Implementation of: [Topic](../interfaces/topic.md)

Defined in: [local.ts:121](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L121)

___

### subscribeSession

▸ **subscribeSession**(`session`: *RpcSession*, `filter`: F, `messageId`: *any*, `ctx`: *any*): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `session` | *RpcSession* |
| `filter` | F |
| `messageId` | *any* |
| `ctx` | *any* |

**Returns:** *Promise*<D\>

Defined in: [local.ts:68](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L68)

___

### throttled

▸ `Private`**throttled**(`f`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `f` | *any* |

**Returns:** *any*

Defined in: [local.ts:62](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L62)

___

### trigger

▸ **trigger**(`filter?`: *Partial*<F\>, `suppliedData?`: TD): *void*

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `filter` | *Partial*<F\> | {} |
| `suppliedData?` | TD | - |

**Returns:** *void*

Implementation of: [Topic](../interfaces/topic.md)

Defined in: [local.ts:45](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L45)

___

### unsubscribe

▸ **unsubscribe**(`params?`: F, `subscriptionKey?`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | F |
| `subscriptionKey?` | *any* |

**Returns:** *void*

Implementation of: [Topic](../interfaces/topic.md)

Defined in: [local.ts:122](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L122)

___

### unsubscribeSession

▸ **unsubscribeSession**(`session`: *RpcSession*, `filter`: F): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `session` | *RpcSession* |
| `filter` | F |

**Returns:** *void*

Defined in: [local.ts:96](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/local.ts#L96)
