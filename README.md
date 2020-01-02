A framework for organizing bidirectional client-server communication based on JSON, featuring server-initiated data push.

Supports multiple pluggable transports:
- WebSocket
- Plain TCP
- REST-like (planned).

Client establishes connection to server (should be publicly available) and then client and server exchange JSON-encoded packets. 

JSON-packets forms high-level protocol, based on [WAMP](https://wamp-proto.org/). Being based on WAMP, protocol 
doesn't strictly conforms to it. Instead it conforms to [OCPP-J RPC Framework](https://ru.scribd.com/document/328580830/OCPP-1-6-JSON-Specification). 
More precisely, Push-RPC protocol is a superset of OCPP-J RPC protocol, with additional push capabilities.     

Push-RPC allows you to:
- create client-initiated connections between client and server
- bi-directionally invoke remote methods on server and client
- subscribe client for server-side events
- auto-reconnect with subscription refresh
- helpers for wrapping communications into handy JS (or TypeScript) objects.

# Possible Applications

- Data-driven apps with or without server-initiated updates
- OCPP-J clients and servers
- IoT devices connecting to servers 
- General client/server apps using WebSockets for communications

# Getting Started

### Installation

```
yarn add @push-rpc/core @push-rpc/websocket
```

For the server, you will also need
```
yarn add ws
```

You can use standard browser WebSockets on the client, or also use `ws` npm package.

### Example code

shared.ts:
```
import {Topic} from "@push-rpc/core"

export interface Services {
  todo: TodoService
}

export interface TodoService {
  addTodo({text}, ctx?): Promise<void>
  todos: Topic<Todo[]>
}

export interface Todo {
  id: string
  text: string
  status: "open" | "closed"
}

```

server.ts:
```
import {createRpcServer, LocalTopicImpl} from "@push-rpc/core"
import {createWebsocketServer} from "@push-rpc/websocket"
import {Services, Todo, TodoService} from "./shared"

let storage: Todo[] = []

class TodoServiceImpl implements TodoService {
  async addTodo({text}) {
    storage.push({
      id: "" + Math.random(),
      text,
      status: "open",
    })

    console.log("New todo item added")
    this.todos.trigger()
  }

  todos = new LocalTopicImpl(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

createRpcServer(services, createWebsocketServer({port: 5555}))

console.log("RPC Server started at ws://localhost:5555")
```

client.ts:

```
import {createRpcClient} from "@push-rpc/core"
import {createWebsocket} from "@push-rpc/websocket"
import {Services} from "./shared"

;(async () => {
  const services: Services = (
    await createRpcClient(1, () => createWebsocket("ws://localhost:5555"))
  ).remote

  console.log("Client connected")

  services.todo.todos.subscribe(todos => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()
```

Run `server.ts` and then `client.ts`. 

Server will send empty todo list on client connecting and then will send updated list on change.

# Goodies

## Using TypeScript to define contract between client and server 

The framework allows you to define and consume your API using TypeScript interface.
The interface definition could be shared between server and client code bases, providing a type-safe 
contract between server and client.

## Also
- Generating client and server RPC proxies based on zero-config TS interface.
- JSON bodies auto-parsing with Date revival. 
- Supported client envs: Node.JS (with `isomorphic-fetch`), browser, ReactNative.

# API

TBD

## WS protocol details

You can use this information to implement `push-rpc` protocol in different languages.

Each message is encoded as JSON array. Each message contain message type, message ID, and multiple payload fields. For example, CALL message:
```
[2, "dfd9742e-2d44-11ea-978f-2e728ce88125", "getRemoteData", {}]
```

<table>
<thead>
<tr>
<th>Message</th>
<th>Details</th>
</tr>
</thead>
<tbody>
<tr>
<td valign="top">CALL, 2</td>
<td>
[2, ID, remoteMethodName, params] <br>
[2, "dfd9742e-2d44-11ea-978f-2e728ce88125", "getUser", {"id": 5}] <br><br>
    
Call remote method with params. <br>
Each remote call results in either RESULT or ERROR message, otherwise timeout error thrown.
</td>
</tr>

<tr>
<td valign="top">RESULT, 3</td>
<td>
[3, ID, response] <br>
[3, "dfd9742e-2d44-11ea-978f-2e728ce88125", {"email": "a@a.com"}] <br><br>
    
Successful result of remote method call. <br>
Message ID is the same as in corresponding CALL message. 
</td>
</tr>

<tr>
<td valign="top">ERROR, 4</td>
<td>
[4, ID, code, description, details] <br>
[4, "dfd9742e-2d44-11ea-978f-2e728ce88125", null, "Invalid Value", {"field": "id"}] <br><br>
    
Indicate error during remote method call. <br>
Message ID is the same as in corresponding CALL message.<br>
Client code will raise Error with message equals to `description` or `code` and details fields copied to Error object. 
</td>
</tr>

<tr>
<td valign="top">SUBSCRIBE, 11</td>
<td>
[11, ID, name, params] <br>
[11, "dfd9742e-2d44-11ea-978f-2e728ce88125", "user", {"id": 246}] <br><br>
    
Subscribe to remote topic with name and parameters. <br>
After subscription , client will receive data updates. <br>  
Right after subscription remote will send current data. <br>
</td>
</tr>

<tr>
<td valign="top">UNSUBSCRIBE, 12</td>
<td>
[12, ID, name, params] <br>
[12, "dfd9742e-2d44-11ea-978f-2e728ce88125", "user", {"id": 246}] <br><br>
    
Unsubscribe remote topic with parameters. <br>
</td>
</tr>

<tr>
<td valign="top">DATA, 13</td>
<td>
[13, ID, name, params, data] <br>
[13, "dfd9742e-2d44-11ea-978f-2e728ce88125", "user", {"id": 246}, {"email": "a@a.com"}] <br><br>
    
Send topic data to subscriber. <br>
Called after subscribe or when data changed. <br>
</td>
</tr>

<tr>
<td valign="top">GET, 14</td>
<td>
[14, ID, name, params] <br>
[14, "dfd9742e-2d44-11ea-978f-2e728ce88125", "user", {"id": 246}, {"email": "a@a.com"}] <br><br>
    
Get topic data without subscription. <br>
Will generate response RESULT message with the same ID. <br>
</td>
</tr>

</tbody>
</table>

 
## Roadmap
- File upload support via multipart encoding (uses `koa-multer` under the hood).
- Binary data download.
- Generation of OpenAPI (Swagger) YAMLs with API description
 
## FAQ

### How to add path to WebSockets (routing)

Often there're multiple WebSocket servers using same port but different paths. You can use following code to route 
connections between those servers.

```
import * as WebSocket from "ws"
import * as http from "http"

function websocketRouter(httpServer, routes) {
  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = url.parse(request.url).pathname

    const serverKey = Object.keys(routes).find(key => pathname.indexOf(key) == 0)

    if (!serverKey) {
      socket.destroy()
    } else {
      const server = routes[serverKey]

      server.handleUpgrade(request, socket, head, ws => {
        server.emit("connection", ws, request)
      })
    }
  })
}

...
const server = http.createServer(requestListener).listen(5555)

const ocppServer: WebSocket.Server = await createOcppServer()
const clientServer: WebSocket.Server = await createClientServer()
const adminServer: WebSocket.Server = await createAdminServer()

websocketRouter(httpServer, {
  ["/ocpp:"]: ocppServer,
  ["/client"]: clientServer,
  ["/admin"]: adminServer,
})
```  
