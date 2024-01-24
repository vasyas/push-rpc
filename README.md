## Glossary

**Remote function**. A function that is implemented at the server side and can be called from the client side. Function
can either be called synchronously or subscribed to. Subscribed function needs to be "triggered" at the server side to
resend the data to the subscribed clients.

Remote function must return Promise and can accept any number of arguments. Note! Variables number of arguments is not
supported. Remote function can throw an error, which will be propagated to the client.

**Services**. Services are used to group remote functions. Services object can be instances of classes or plain objects.
Services can be nested.

**Context**. Only lives at the server side. Contains metadata about request and connection. It is passed to all the
middlewares and remote functions as the last parameter. A new context object is created for each invocation. For
subscriptions, context is initially created during 'subscribe' invocation and is copied to each 'trigger' invocation.

**Middlewares**. Middlewares are used to intercept client and server requests. Both calls and subscriptions can be
intercepted?. Middlewares can be attached on both client and server side. Middlewares receive context as the last
arguments in the invocation. Middleware can modify context.
