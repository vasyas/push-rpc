HTTP transport for Push-RPC.

Server-side push is not supported, only client-initiated messages are enabled.

Integrates with Koa or Express for HTTP server.
Uses Fetch for making HTTP requests.

## How to use (with Koa)

```
import * as Koa from "koa"
import {createRpcServer, createRpcClient} from "@push-rpc/core"
import {createKoaHttpServer, createHttpClient} from "@push-rpc/http"

...

/* server part */
const services = {
  async getHello() {
    return "Hello from Server"
  },
}

// remote id is required for assigning separate HTTP requests to a single session 
function getRemoteId(ctx: Koa.Context) {
  return "1" // share a single session for now, real impl could use cookies or some other meaning for HTTP sessions
}

createRpcServer(services, createKoaHttpServer(5555, getRemoteId))

...

/* client part */
const {remote} = await createRpcClient(0, () => createHttpClient("http://localhost:5555"))
console.log("From server: " + (await remote.getHello()))
```

## Mapping between Push-RPC protocol and HTTP

All requests and responses are JSON-encoded.

Request path specifies operation to be invoked or topic to be queried. Path is static, no parameters is path are supported.
Use request body instead to send parameters.

Query string parameters are not used. 

When error is returned from the server, response is 400, response status string contains error message,
response body contains error details in JSON-format.

<table>
<thead>
<tr>
<th>Push-RPC Message Type</th>
<th>HTTP Verb</th>
<th>Description</th>
</tr>
</thead>
<tbody>
<tr>
<td valign="top">CALL</td>
<td valign="top">POST</td>
<td>
    Calls a remote method. POST body is request object, response body is response object. 
</td>
</tr>
<tr>
<td valign="top">GET</td>
<td valign="top">PUT</td>
<td>
    Query topic once for a data. POST body is query parameters, response body is response object. 
</td>
</tr>
<tr>
<td valign="top">SUBSCRIBE</td>
<td valign="top">PATCH</td>
<td>
    Subscribe topic for a data, but server will return them only once. Behaves the same as GET type.
    POST body is query parameters, response body is response object. 
</td>
</tr>
</tbody>
</table> 