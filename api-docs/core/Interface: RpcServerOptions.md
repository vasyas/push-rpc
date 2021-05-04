# Interface: RpcServerOptions

## Properties

### callTimeout

• `Optional` **callTimeout**: *number*

Defined in: [server.ts:18](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L18)

___

### clientLevel

• `Optional` **clientLevel**: *number*

Defined in: [server.ts:14](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L14)

___

### keepAliveTimeout

• `Optional` **keepAliveTimeout**: *number*

Defined in: [server.ts:17](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L17)

___

### listeners

• `Optional` **listeners**: *object*

#### Type declaration:

| Name | Type |
| :------ | :------ |
| `connected?` | (`remoteId`: *string*, `connections`: *number*) => *void* |
| `disconnected?` | (`remoteId`: *string*, `connections`: *number*) => *void* |
| `messageIn` | (`remoteId`: *string*, `data`: *string*) => *any* |
| `messageOut` | (`remoteId`: *string*, `data`: *string*) => *any* |
| `subscribed` | (`subscriptions`: *number*) => *any* |
| `unsubscribed` | (`subscriptions`: *number*) => *any* |

Defined in: [server.ts:21](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L21)

___

### localMiddleware

• `Optional` **localMiddleware**: [*Middleware*](../wiki/Home#middleware)

Defined in: [server.ts:12](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L12)

___

### pingSendTimeout

• `Optional` **pingSendTimeout**: *number*

Defined in: [server.ts:16](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L16)

___

### remoteMiddleware

• `Optional` **remoteMiddleware**: [*Middleware*](../wiki/Home#middleware)

Defined in: [server.ts:13](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L13)

___

### syncRemoteCalls

• `Optional` **syncRemoteCalls**: *boolean*

Defined in: [server.ts:19](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L19)

## Methods

### createConnectionContext

▸ `Optional`**createConnectionContext**(`socket`: [*Socket*](../wiki/Interface:%20Socket), ...`transportDetails`: *any*): *Promise*<[*RpcConnectionContext*](../wiki/Interface:%20RpcConnectionContext)<any\>\>

#### Parameters:

| Name | Type |
| :------ | :------ |
| `socket` | [*Socket*](../wiki/Interface:%20Socket) |
| `...transportDetails` | *any* |

**Returns:** *Promise*<[*RpcConnectionContext*](../wiki/Interface:%20RpcConnectionContext)<any\>\>

Defined in: [server.ts:11](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L11)

___

### messageParser

▸ `Optional`**messageParser**(`data`: *any*): *any*[]

#### Parameters:

| Name | Type |
| :------ | :------ |
| `data` | *any* |

**Returns:** *any*[]

Defined in: [server.ts:15](https://github.com/vasyas/typescript-rpc/blob/a0baed0/packages/core/src/server.ts#L15)
