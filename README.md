A TypeScript framework for organizing bidirectional typesafe client-server communication. Supports
server-initiated data push (subscriptions). Uses HTTP, JSON and, optionally, WebSockets.
Main focus is on simplicity and good developer experience.

Best used with monorepos using TypeScript. Can also be used with JavaScript and non-JS clients.

## Table of Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Implementation details](#implementation)
  - [Mapping to HTTP & WebSockets messages](#messages)
  - [Authentication and client identity](#auth)
  - [Detecting stale WebSockets](#stale-websockets)
  - [Recovering after network or application lifecycle changes](#recovery)
- [Limitations](#limitations)
- [Glossary](#glossary)
- [Project using Push-RPC](#projects)

## Features <a name="features" id="features"></a>

- Developer friendly - remote call is a plain TS call for easy tracing between client and server and good
  IDE integration.
- Based on HTTP, easy to integrate with existing infrastructure. Call visibility in browser DevTools.
- Gradually upgradeable - WS is only used when you need subscriptions.
- Server runs on Node.JS, client runs in the Node.JS/Browser/React Native.

Extra:

- Client & Server middlewares.
- Consume compressed HTTP requests.
- Send & receive plain-text data.
- Throttling for subscriptions.
- Broken WS connection detection & auto-reconnecting.

## Getting started <a name="getting-started"></a>

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

## Implementation details <a name="implementation"></a>

### Mapping to HTTP & WebSockets messages <a name="messages"></a>

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
   available at server side in the context. Note that the client ID is asserted by the client and is not
   authenticated by the library — see [Authentication and client identity](#auth).

   In addition, GET method can be used to make a call without arguments.

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

   Server accepts subscribe requests before WS connection is established. Server do not track client subscriptions.
   On WS connection established, client should re-sent subscribe requests. In response, server will provide up-to-date
   data.

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

Both client & server will try to detect broken connections by sending WS ping/pongs.

### Authentication and client identity <a name="auth"></a>

The **client ID** identifies the connecting Push-RPC client (the party that opens the connection) — it is **not** an
end-user identity, and Push-RPC performs no authentication of its own. By default the client ID is asserted by the
client: it is read from the `X-Rpc-Client-Id` header for HTTP requests and from the `Sec-Websocket-Protocol` header
for WebSocket connections. The server trusts whatever the client sends, so by default one client could connect using
another client's ID and receive its push stream.

Authentication and authorization are intentionally left to the application, since different projects approach them
differently. The seam for this is `createConnectionContext`, which is called for **both** HTTP requests and WebSocket
upgrades:

- Throwing inside it rejects the request (HTTP) or the upgrade (the WebSocket handshake responds `401` and the socket
  is closed). This is where you can reject unauthenticated connections.
- Its return value becomes the connection context.

The exported `getClientId(req)` helper reads the client ID from the `X-Rpc-Client-Id` header or the
`Sec-Websocket-Protocol` header, so you can reuse the default behavior while adding your own checks:

```ts
import {getClientId, RpcError} from "@push-rpc/next"

await publishServices(services, {
  port: 8080,
  path: "/rpc",
  async createConnectionContext(req) {
    const session = await validateSession(req) // your application's auth
    if (!session) throw new RpcError(401, "Unauthorized")

    return {clientId: getClientId(req) ?? "anon"}
  },
})
```

`res` is only provided for HTTP requests; it is `undefined` during a WebSocket upgrade.

### Detecting stale WebSockets <a name="stale-websockets"></a>

Detecting stale WebSocket connections is crucial for both server and client. For server, it is important to know
when to clean up resources associated with the client. For client, it is important to know when to try to reconnect.

In Push-RPC, the client is detecting stale connections by measuring time between incoming messages. If no messages
arrived for `pingInterval * 1.5` milliseconds, connection is considered stale and reconnection is initiated.
Client option `pingInterval` is specified when consuming service. By default, stale connection detection is disabled.

Server is detecting stale connections by sending WS ping messages every `pingInterval` milliseconds. If no pong
response is received within `pingInterval * 2` milliseconds, connection is considered stale and closed. Server option
`pingInterval` is specified when publishing services. It is 30 secs by default.

Since WebSockets in React Native don't support listening for incoming native WS ping messages, it is impossible to
use the native WS ping/pong mechanism for stale connection detection. Due to this limitation,
application ping/pongs are implemented instead.

### Recovering after network or application lifecycle changes <a name="recovery"></a>

Use `client.reconnect({immediate: true})` when confirmed connectivity or an application resume
requires a fresh connection without waiting for an existing retry delay. The client ID, consumers
and cached data are preserved; opening the replacement refreshes active subscriptions.

Recovery depends on whether the client has a `reconnectPolicy`:

| Call                                                     | Behavior                                                                                                                      |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `reconnect()` without a policy                           | Immediately abandons the old socket, including an opening handshake, and wakes a pending legacy retry delay.                  |
| `reconnect()` with a policy                              | Abandons a stale socket and follows the policy's delay. Duplicate calls during a scheduled or opening recovery are coalesced. |
| `reconnect({immediate: true})` with either configuration | Wakes a pending retry or replaces the active socket immediately. An already opening handshake is reused.                      |

Abandonment disconnects the old socket logically before asking the native WebSocket to close,
so a missing `close` event cannot block recovery. An immediate request that starts or wakes a
recovery resets policy backoff to its base window. If a handshake is already opening, its existing
deadline **and retry history** are kept; repeated signals cannot restart the handshake timeout.

The application should coalesce duplicate foreground/network events for the same outage and skip
signals already satisfied by an automatic reconnect. The library does not know the application's
lifecycle; another signal after recovery completes can otherwise replace a healthy connection.

For a fast first recovery with randomized backoff after failures:

```ts
const {client, remote} = await consumeServices<Services>(url, {
  reconnectPolicy: {
    firstReconnectDelayMs: 0,
    minDelayMs: 1000,
    maxDelayMs: 5000,
    backoffFactor: 2,
    maxBackoffMs: 30000,
    stableConnectionMs: 30000,
    connectTimeoutMs: 10000,
  },
  resubscribeConcurrency: 2,
})

// In the application's confirmed connectivity/resume handler:
client.reconnect({immediate: true})
```

With this configuration, the first connection attempt has no intentional delay. After a connection
remains stable for 30 seconds, its first automatic recovery also has no intentional delay. Failed
attempts then use randomized windows of 1–5, 1–10, 1–20 and finally 1–30 seconds. A cold-start failure
uses the base retry window too; a brief successful opening does not reset existing retry history.
Omitting `firstReconnectDelayMs` makes even recovery after a stable connection use the randomized
window. Set `spreadInitialConnect: true` to apply that window to the very first connection as well.
Without `reconnectPolicy`, legacy retry timing is unchanged.

The 10-second handshake deadline in this example applies to immediate attempts too. If JavaScript
timers fire substantially late after suspension, a retry is rescheduled within the same window,
and the stability timer starts another full stability period. An explicit immediate request can
still wake the pending retry. The SDK itself does not subscribe to native lifecycle/network events.

This configuration spreads failed retries, **not the first wave** after a regional outage. The
`resubscribeConcurrency` limit applies per client, not across the server. It limits recovery HTTP
snapshots and counts unfinished work from earlier waves; superseded queued work is discarded.
Initial subscription requests remain eager and can exceed this limit, but occupy slots until their
HTTP work finishes, so recovery waits for capacity. Regular RPC calls are not throttled. Omitting
`resubscribeConcurrency` retains unlimited recovery concurrency.

Use `client.resubscribe()` to refresh active snapshots without replacing the socket. If requests
for the same topic and parameters overlap, only the newest request can update its data or queue.
Late failures or responses from an earlier request cannot discard or overwrite the recovered data.
A superseded `subscribe()` follows the replacement snapshot and propagates its failure. An explicit
`CallOptions.timeout` still bounds that replacement wait from the original subscription call.
The HTTP request timeout starts after `getHeaders()` resolves and remains active until the response
body has been read. Unsubscribing the last consumer ends that subscription's lifetime; a later
subscription with identical parameters is independent of its old replies.

`client.close()` permanently stops the client and is intended for disposal. Neither `connect()` nor
`reconnect()` revives it. A closing handshake that hangs is abandoned or terminated after 10 seconds.
Without a reconnect policy, heartbeat recovery uses that fallback when the WebSocket implementation
has no `terminate()` method. With a policy, heartbeat recovery abandons the socket immediately and
then follows the policy's recovery delay.

## Limitations <a name="limitations"></a>

- Cookies are not been sent during HTTP & WS requests.
- Request bodies are limited to 1 MB by default, measured after decompression (so a small compressed body that
  expands to a large one is rejected too). Over-limit requests get a `413` response. Change it with the
  `maxRequestSize` option, or set it to `Infinity` to disable.

## Glossary <a name="glossary"></a>

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

**Middlewares**. Middlewares are used to intercept client requests, server requests implementations and client
notifications. Both calls and subscriptions can be intercepted. Middlewares can be attached on both client and server
side. Middleware can modify context and parameters and data.

Request middleware is called with parameters (ctx, next, ...parameters)
Client notifications middleware is called with parameters (ctx, next, data, parameters).

**Throttling**. Used to limit number of notifications from the remote functions. With throttling enabled, not all
triggers will result in new notifications. Throttling can be used with reducers to aggregate values supplied in
triggers.

## Project using Push-RPC <a name="projects"></a>

- [General Bots](https://github.com/GeneralBots/BotServer). A strongly typed LLM conversational platform focused in
  convention over configuration and code-less approaches.
- [ECOFACTOR Network](https://ecofactortech.com/en/efn/). An EV Charge Point management system, leading the way in
  smart charging and V2G technology.
- [Jibo](https://robotsguide.com/robots/jibo). A friendly robo-assistant designed to become "part of the family."
