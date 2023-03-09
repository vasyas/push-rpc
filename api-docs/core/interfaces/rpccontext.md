[@push-rpc/core](../README.md) / RpcContext

# Interface: RpcContext<Remote\>

## Type parameters

| Name | Default |
| :------ | :------ |
| `Remote` | *any* |

## Hierarchy

* [*RpcConnectionContext*](rpcconnectioncontext.md)<Remote\>

  ↳ **RpcContext**

## Table of contents

### Properties

- [item](rpccontext.md#item)
- [itemName](rpccontext.md#itemname)
- [messageId](rpccontext.md#messageid)
- [protocol](rpccontext.md#protocol)
- [remote](rpccontext.md#remote)
- [remoteId](rpccontext.md#remoteid)

## Properties

### item

• **item**: ServiceItem

Defined in: [rpc.ts:71](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L71)

___

### itemName

• `Optional` **itemName**: *string*

Defined in: [rpc.ts:73](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L73)

___

### messageId

• `Optional` **messageId**: *string*

Defined in: [rpc.ts:72](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L72)

___

### protocol

• `Optional` **protocol**: *string*

Inherited from: [RpcConnectionContext](rpcconnectioncontext.md).[protocol](rpcconnectioncontext.md#protocol)

Defined in: [rpc.ts:64](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L64)

___

### remote

• **remote**: Remote

Defined in: [rpc.ts:69](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L69)

___

### remoteId

• **remoteId**: *string*

Inherited from: [RpcConnectionContext](rpcconnectioncontext.md).[remoteId](rpcconnectioncontext.md#remoteid)

Defined in: [rpc.ts:63](https://github.com/vasyas/typescript-rpc/blob/2053b37/packages/core/src/rpc.ts#L63)
