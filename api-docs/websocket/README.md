@push-rpc/websocket

# @push-rpc/websocket

## Table of contents

### Functions

- [createNodeWebsocket](README.md#createnodewebsocket)
- [createWebsocketServer](README.md#createwebsocketserver)

## Functions

### createNodeWebsocket

▸ **createNodeWebsocket**(`url`: *any*, `protocol?`: *any*): Socket

#### Parameters:

| Name | Type |
| :------ | :------ |
| `url` | *any* |
| `protocol?` | *any* |

**Returns:** Socket

Defined in: [server.ts:21](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/websocket/src/server.ts#L21)

___

### createWebsocketServer

▸ **createWebsocketServer**(`options?`: WebSocket.ServerOptions): SocketServer & { `wss`: WebSocket.Server  }

#### Parameters:

| Name | Type |
| :------ | :------ |
| `options` | WebSocket.ServerOptions |

**Returns:** SocketServer & { `wss`: WebSocket.Server  }

Defined in: [server.ts:4](https://github.com/vasyas/typescript-rpc/blob/c658db8/packages/websocket/src/server.ts#L4)
