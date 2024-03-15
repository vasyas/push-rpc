A TypeScript framework for organizing bidirectional typesafe client-server communication, including
server-initiated data push (subscriptions). Uses HTTP, JSON and, optionally, WebSockets.
Main focus is on simplicity and developer experience.

Best used with monorepos using TypeScript. Can also be used with JavaScript and non-JS clients.

## Features

- Developer friendly - remote call is plain TypeScript calls for easy call tracing between client and server and good
  integration with IDE. Call visibility in Browser DevTools.
- Based on HTTP, easy to integrate with existing infrastructure.
- Gradually upgradeable - WS is only used when you need subscriptions.
- Supports compressed HTTP requests.
- Server runs on Node.JS, client runs in the Node.JS/Browser/ReactNative. Bun/Deno should also work, but not officially
  supported.

## Getting Started

```
npm install @push-rpc/next
```

For implmeneting subscriptions at backend, you'll also need to install ws package:

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

## History

Started in 2019, the project was called `Push-RPC`. All messaging between client and server was over WebSockets.
But it appeared that HTTP is a better fit for most of the use cases. So, in 2024, the project was renamed to `Push-RPC

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

## Issues / TBDs

- [important] Importing index.js from the root of the package will import node's http package. Not good for clients.
- Browser sockets don't have 'ping' event. Need to find a different way to detect connection loss.

# Limitations

- Cookies are not been sent during HTTP & WS requests.