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

* [*Topic*](../wiki/Interface:%20Topic)<D, F, TD\>

## Constructors

### constructor

\+ **new LocalTopicImpl**<D, F, TD\>(`supplier`: [*DataSupplier*](../wiki/Home#datasupplier)<D, F\>, `opts?`: *Partial*<LocalTopicImplOpts<D, F, TD\>\>): [*LocalTopicImpl*](../wiki/Class:%20LocalTopicImpl)<D, F, TD\>

#### Type parameters:

| Name | Default |
| :------ | :------ |
| `D` | - |
| `F` | - |
| `TD` | D |

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `supplier` | [*DataSupplier*](../wiki/Home#datasupplier)<D, F\> | - |
| `opts` | *Partial*<LocalTopicImplOpts<D, F, TD\>\> | {} |

**Returns:** [*LocalTopicImpl*](../wiki/Class:%20LocalTopicImpl)<D, F, TD\>

Overrides: TopicImpl.constructor

Defined in: [local.ts:21](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L21)

## Properties

### name

• `Private` **name**: *string*

Defined in: [local.ts:35](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L35)

___

### subscriptions

• `Protected` **subscriptions**: *object*= {}

#### Type declaration:

Defined in: [local.ts:105](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L105)

## Methods

### get

▸ **get**(`params?`: F): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | F |

**Returns:** *Promise*<D\>

Implementation of: [Topic](../wiki/Interface:%20Topic)

Defined in: [local.ts:113](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L113)

___

### getData

▸ **getData**(`filter`: F, `ctx`: *any*): *Promise*<D\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `filter` | F |
| `ctx` | *any* |

**Returns:** *Promise*<D\>

Defined in: [local.ts:53](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L53)

___

### getTopicName

▸ **getTopicName**(): *string*

**Returns:** *string*

Defined in: [local.ts:37](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L37)

___

### isSubscribed

▸ **isSubscribed**(): *boolean*

**Returns:** *boolean*

Defined in: [local.ts:107](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L107)

___

### setTopicName

▸ **setTopicName**(`s`: *string*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `s` | *string* |

**Returns:** *void*

Defined in: [local.ts:41](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L41)

___

### subscribe

▸ **subscribe**(`consumer`: [*DataConsumer*](../wiki/Home#dataconsumer)<D\>, `params`: F, `subscriptionKey`: *any*): *Promise*<void\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `consumer` | [*DataConsumer*](../wiki/Home#dataconsumer)<D\> |
| `params` | F |
| `subscriptionKey` | *any* |

**Returns:** *Promise*<void\>

Implementation of: [Topic](../wiki/Interface:%20Topic)

Defined in: [local.ts:116](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L116)

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

Defined in: [local.ts:63](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L63)

___

### throttled

▸ `Private`**throttled**(`f`: *any*): *any*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `f` | *any* |

**Returns:** *any*

Defined in: [local.ts:57](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L57)

___

### trigger

▸ **trigger**(`filter?`: *Partial*<F\>, `suppliedData?`: TD): *void*

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `filter` | *Partial*<F\> | {} |
| `suppliedData?` | TD | - |

**Returns:** *void*

Implementation of: [Topic](../wiki/Interface:%20Topic)

Defined in: [local.ts:45](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L45)

___

### unsubscribe

▸ **unsubscribe**(`params?`: F, `subscriptionKey?`: *any*): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `params?` | F |
| `subscriptionKey?` | *any* |

**Returns:** *void*

Implementation of: [Topic](../wiki/Interface:%20Topic)

Defined in: [local.ts:117](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L117)

___

### unsubscribeSession

▸ **unsubscribeSession**(`session`: *RpcSession*, `filter`: F): *void*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `session` | *RpcSession* |
| `filter` | F |

**Returns:** *void*

Defined in: [local.ts:91](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/local.ts#L91)
