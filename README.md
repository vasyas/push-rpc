A TypeScript framework for organizing bidirectional typesafe client-server communication. Supports
server-initiated data push (subscriptions). Uses HTTP, JSON and, optionally, WebSockets.
Main focus is on simplicity and good developer experience.

Best used with monorepos using TypeScript. Can also be used with JavaScript and non-JS clients.

## Features

- Developer friendly - remote call is a plain TS call for easy tracing between client and server and good
  IDE integration.
- Based on HTTP, easy to integrate with existing infrastructure. Call visibility in browser DevTools.
- Gradually upgradeable - WS is only used when you need subscriptions.
- Server runs on Node.JS, client runs in the Node.JS/Browser/ReactNative.

Extra:

- Client & Server middlewares.
- Consume compressed HTTP requests.
- Send & receive plain-text data.
- Throttling for subscriptions.
- Broken WS connection detection & auto-reconnecting.

## History note!

Initially this project supported WS-only communication akin to OCPP-J protocol for EV charging stations.
Since that, library for OCPP-J was extracted to a separate project and this project was reworked to focus on generic
client/server communication.

## Getting Started

```
npm install @push-rpc/next
```

For implementing subscriptions at backend, you'll also need to install ws package:

```
npm install ws
```

Contract between server and client is defined in shared module.

api.ts:

```
// Note that API definition is plain TypeScript and is independent of the library

export type Services = {
  todo: TodoService
}

export type TodoService = {
  addTodo(req: {text: string}, ctx?: any): Promise<void>
  getTodos(ctx?: any): Promise<Todo[]>
}

export type Todo = {
  id: string
  text: string
  status: "open" | "closed"
}

```

Contact then used in client.ts:

```
import {Services} from "./api"
import {consumeServices} from "@push-rpc/next"

async function startClient() {
  const {remote} = await consumeServices<Services>("http://127.0.0.1:8080/rpc")

  console.log("Client created")

  await remote.todo.getTodos.subscribe((todos) => {
    console.log("Got todo items", todos)
  })

  await remote.todo.addTodo({text: "Buy groceries"})
}

startClient()

```

And implemented in server.ts:

```
import {Todo, TodoService} from "./api"
import {publishServices} from "@push-rpc/next"

async function startServer() {
  const storage: Todo[] = []

  class TodoServiceImpl implements TodoService {
    async addTodo({text}: {text: string}) {
      storage.push({
        id: "" + Math.random(),
        text,
        status: "open",
      })

      console.log("New todo item added")
      services.todo.getTodos.trigger()
    }

    async getTodos() {
      return storage
    }
  }

  const {services} = await publishServices(
    {
      todo: new TodoServiceImpl(),
    },
    {
      port: 8080,
      path: "/rpc",
    }
  )

  console.log("RPC Server started at http://localhost:8080/rpc")
}

startServer()
```

Run server.ts and then client.ts.

Server will send empty todo list on client connecting and then will send updated list on adding new item.

## Protocol Details

There are the types of messages that can be sent from client to server:

1. **Call** - a request to synchronously execute a remote function. Implemented as HTTP POST request. URL contains the
   remote function name. Body contains JSON-encoded list of arguments. Response is JSON-encoded result of the
   function.

   ```
   POST /rpc/todo/addTodo HTTP/1.1
   Content-Type: application/json
   X-Rpc-Client-Id: GoQ_xVYcthSEqMxDGV212
    
   [{"text": "Buy groceries"}]
   
   ...
   HTTP/1.1 200 OK
   Content-Type: application/json
   {"id": "123"}
    ```

   `X-Rpc-Client-Id` header is used to identify caller clients. In can be used for session tracking. Client ID is
   available at server side in the context.

2. **Subscribe** - a request to subscribe to a remote function updates. Implemented as HTTP PUT request. URL contains
   the remote function name. Body contains JSON-encoded list of arguments. Response is JSON-encoded result of the
   function.

   ```
   PUT /rpc/todo/getTodos HTTP/1.1
   Content-Type: application/json
    
   []
   
   ...
   HTTP/1.1 200 OK
   Content-Type: application/json
   [{"id": 1, text: "Buy groceries", status: "open"}]
   ```

   Before subscribing, client would establish a WebSocket connection to the server. Server would then use established
   connection to send subscription updates. Client ID is used to link WebSocket connection and HTTP requests.

3. **Unsubscribe** - a request to unsubscribe from a remote function updates. Implemented as HTTP PATCH request. URL
   contains the remote function name. Body contains JSON-encoded list of arguments. Response is always empty.

   ```
   PATCH /rpc/todo/getTodos HTTP/1.1
   Content-Type: application/json
    
   []
   
   ...
   HTTP/1.1 204 No Content
   ```

Server sends updates to subscribed clients using WebSocket connection. Clients establish WebSocket connection using
the base URL:

```
GET /rpc HTTP/1.1
Connection: Upgrade
Upgrade: websocket
Sec-Websocket-Protocol: GoQ_xVYcthSEqMxDGV212
```

`Sec-Websocket-Protocol` header is used to transfer client ID.

After successful subscription, server sends updates to the client. Each update is a JSON-encoded message containing
topic name, remote function result and subscription parameters if any:

```
["todo/getTodos", [{"id": 1, text: "Buy groceries", status: "open"}], ...]
```

Both client & server will try to connect broken connections by sending WS ping/pongs.

## Glossary

**Remote function**. A function that is implemented at the server side and can be called from the client side. Function
can either be called synchronously or subscribed to. Subscribed function needs to be "triggered" at the server side to
resend the data to the subscribed clients. Sometimes remote function is called "item".

Remote function must return Promise and can accept any number of arguments. Note! Variables number of arguments is not
supported (because optional argument is used for context and CallOptions). Remote function can throw an error, which
will be propagated to the client.

**Services**. Services are used to group remote functions. Services object can be instances of classes or plain objects.
Services can be nested.

**Context**. Only lives at the server side. Contains metadata about request and connection. It is passed to all the
middlewares and remote functions as the last parameter. For subscriptions, context is initially created during '
subscribe' invocation and copied to each 'trigger' invocation. Context, created by overriding `createContext`, should
contain only JSON data, to allow copying. Context can be modified in middlewares; these modification doesn't have to be
JSON-only.

**Middlewares**. Middlewares are used to intercept client and server requests. Both calls and subscriptions can be
intercepted. Middlewares can be attached on both client and server side. Middlewares receive context as the last
arguments in the invocation. Middleware can modify context.

**Throttling**. Used to limit number of notifications from the remote functions. With throttling enabled, not all
triggers will result in new notifications. Throttling can be used with reducers to aggregate values supplied in
triggers.

# Limitations

- Cookies are not been sent during HTTP & WS requests.