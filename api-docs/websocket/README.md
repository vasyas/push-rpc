@push-rpc/websocket

# @push-rpc/websocket

## Table of contents

### Functions

- [createNodeWebsocket](README.md#createnodewebsocket)
- [createWebsocketServer](README.md#createwebsocketserver)

## Functions

### createNodeWebsocket

▸ **createNodeWebsocket**(`url`: *string*, `protocol?`: *string* \| *string*[]): Socket

Create Push-RPC Socket using WebSocket transport.

Uses [ws](https://github.com/websockets/ws) NPM package under the hood.

#### Parameters:

| Name | Type |
| :------ | :------ |
| `url` | *string* |
| `protocol?` | *string* \| *string*[] |

**Returns:** Socket

Defined in: [server.ts:31](https://github.com/vasyas/typescript-rpc/blob/4c1eb2a/packages/websocket/src/server.ts#L31)

___

### createWebsocketServer

▸ **createWebsocketServer**(`options?`: WebSocket.ServerOptions): SocketServer & { `wss`: WebSocket.Server  }

Create Push-RPC SocketServer using WebSocket transport.

Uses [ws](https://github.com/websockets/ws) NPM package under the hood.

#### Parameters:

| Name | Type |
| :------ | :------ |
| `options` | WebSocket.ServerOptions |

**Returns:** SocketServer & { `wss`: WebSocket.Server  }

Defined in: [server.ts:9](https://github.com/vasyas/typescript-rpc/blob/4c1eb2a/packages/websocket/src/server.ts#L9)
