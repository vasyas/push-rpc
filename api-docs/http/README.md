@push-rpc/http

# @push-rpc/http

## Table of contents

### Functions

- [createExpressHttpMiddleware](README.md#createexpresshttpmiddleware)
- [createHttpClient](README.md#createhttpclient)
- [createKoaHttpMiddleware](README.md#createkoahttpmiddleware)

## Functions

### createExpressHttpMiddleware

▸ **createExpressHttpMiddleware**(`getRemoteId`: (`ctx`: *any*) => *string*): *object*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `getRemoteId` | (`ctx`: *any*) => *string* |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `middleware` | *any* |
| `onConnection` | *any* |
| `onError` | *any* |

Defined in: [server.ts:50](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/http/src/server.ts#L50)

___

### createHttpClient

▸ **createHttpClient**(`urlPrefix`: *string*, `headers?`: {}): Socket

#### Parameters:

| Name | Type | Default value |
| :------ | :------ | :------ |
| `urlPrefix` | *string* | - |
| `headers` | *object* | {} |

**Returns:** Socket

Defined in: [client.ts:5](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/http/src/client.ts#L5)

___

### createKoaHttpMiddleware

▸ **createKoaHttpMiddleware**(`getRemoteId`: (`ctx`: *any*) => *string*): *object*

#### Parameters:

| Name | Type |
| :------ | :------ |
| `getRemoteId` | (`ctx`: *any*) => *string* |

**Returns:** *object*

| Name | Type |
| :------ | :------ |
| `middleware` | *any* |
| `onConnection` | *any* |
| `onError` | *any* |

Defined in: [server.ts:5](https://github.com/vasyas/typescript-rpc/blob/a0bd7db/packages/http/src/server.ts#L5)
