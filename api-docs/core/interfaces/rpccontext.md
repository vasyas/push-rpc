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

Defined in: [rpc.ts:67](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L67)

___

### itemName

• `Optional` **itemName**: *string*

Defined in: [rpc.ts:69](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L69)

___

### messageId

• `Optional` **messageId**: *string*

Defined in: [rpc.ts:68](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L68)

___

### protocol

• `Optional` **protocol**: *string*

Inherited from: [RpcConnectionContext](rpcconnectioncontext.md).[protocol](rpcconnectioncontext.md#protocol)

Defined in: [rpc.ts:60](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L60)

___

### remote

• **remote**: Remote

Defined in: [rpc.ts:65](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L65)

___

### remoteId

• **remoteId**: *string*

Inherited from: [RpcConnectionContext](rpcconnectioncontext.md).[remoteId](rpcconnectioncontext.md#remoteid)

Defined in: [rpc.ts:59](https://github.com/vasyas/typescript-rpc/blob/4afbec1/packages/core/src/rpc.ts#L59)
