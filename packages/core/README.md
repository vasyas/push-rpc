# TypeScript-first RPC library with data push capabilities

This library allows you to define and consume your API using TypeScript interface.
The interface definition could be share between your server and client code bases, providing you with type-safe 
contract between server and client.

In addition, library makes it easy to push changes from server to data (aka server-initiated refresh).

Uses WebSockets as transport. 

## Example

### Installation

```
yarn add typescript-push-rpc
```

For the server, you will also need
```
yarn add ws
```

You can use standard browser WebSockets on the client, or also use `ws` npm package.

### Code

shared.ts:
```
import {Topic} from "../src/index"

export interface Services {
  todo: TodoService
}

export interface TodoService {
  addTodo({text}): Promise<void>
  todos: Topic<{}, Todo[]>
}

export interface Todo {
  id: string
  text: string
  status: "open" | "closed"
}
```

server.ts:
```
import {createRpcServer, ServerTopicImpl} from "../src/index"
import {Services, TodoService, Todo} from "./shared"
import * as WebSocket from "ws"

let storage: Todo[] = []

class TodoServiceImpl implements TodoService {
  async addTodo({text}) {
    storage.push({
      id: "" + Math.random(),
      text,
      status: "open",
    })

    console.log("New todo item added")

    this.todos.trigger({})
  }

  todos = new ServerTopicImpl(async () => storage)
}

const services: Services = {
  todo: new TodoServiceImpl(),
}

const rpcWebsocketServer = new WebSocket.Server({port: 5555})
createRpcServer(services, rpcWebsocketServer)

console.log("RPC Server started at ws://localhost:5555")
```

client.ts:

```
import * as WebSocket from "ws"
import {Services} from "./shared"
import {createRpcClient} from "../src"

(async () => {
  const services: Services = await createRpcClient({
    level: 1,
    createWebSocket: () => new WebSocket("ws://localhost:5555")
  })

  console.log("Client connected")

  services.todo.todos.subscribe({}, (todos) => {
    console.log("Got todo items", todos)
  })

  await services.todo.addTodo({text: "Buy groceries"})
})()
```

Run `server.ts` and then `client.ts`. 

Server will send empty todo list on client connecting and then will send updated list on change.

## API

TBD

## WS protocol details

You can use this information to implement Typescrip-Push-Rpc protocol in different languages.

TBD
 
## Features
- Generating client and server RPC proxies based on zero-config TS interface.
- JSON bodies auto-parsing with Date revival. 
- Supported client envs: Node.JS (with `isomorphic-fetch`), browser, react-native(see notes).
- Auto-reconnect with maintaining list of subscriptions on WS disconnect

## TODO
- File upload support via multipart encoding (uses `koa-multer` under the hood).
- Binary data download.
- Generation of OpenAPI (Swagger) YAMLs with API description
 
## Implementation flaws
- untyped File in Multipart definition
- untyped File in binary download
- ctx parameter is untyped and should be defined in the base interface


## Notes on the implementation

### React-Native clients

For generating clients ES6 Proxy is used. However, React-Native doesn't support ES6 proxy 
on some devices, see [this RN Issue](https://github.com/facebook/react-native/issues/11232#issuecomment-264100958]).
And no polyfills could exist that will handle dynamic properties. So for React Native you 
should explicitly list your interface operations:
```
export let backend: Backend = createClient(url, { ... }, 
    [ "login", "resetPassword", etc ]
)
``` 


## FAQ

### How to add path to websockets (routing)

### Importance of naming service methods