Client/server framework

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
intercepted?. Middlewares can be attached on both client and server side. Middlewares receive context as the last
arguments in the invocation. Middleware can modify context.

**Throttling**. Used to limit number of notifications from the remote functions. With throttling enabled, not all
triggers will result in new notifications. Throttling can be used with reducers to aggregate values supplied in
triggers.

## Issues / TBDs

- [important] Importing index.js from the root of the package will import node's http package. Not good for clients.
- Browser sockets don't have 'ping' event. Need to find a different way to detect connection loss.
- Перевірити, що throttling працює відразу для всіх підписників

## Features

- Developer friendly - everything is plain TypeScript calls, easy call tracing between client and server, good
  integration with IDE & Browser DevTools
- Based on HTTP, easy to integrate with existing infrastructure
- Gradually upgradeable - WS is only used when you need subscriptions
- Supports compressed HTTP requests.
- Server runs on Node.JS, client runs in the Node.JS/Browser/ReactNative. For RN some extra setup is required (
  document). Bun/Deno should also work, but not officially supported.

# Limitations

- Cookies are not supported.