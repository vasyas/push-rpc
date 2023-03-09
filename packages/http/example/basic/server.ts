import * as Koa from "koa"
import {createRpcServer, setLogger} from "@push-rpc/core"
import {createKoaHttpMiddleware} from "../../src"

setLogger(console)

const services = {
  async getHello() {
    return "Hello from Server"
  },
}

const app = new Koa()
const server = app.listen(5555)

const {onError, onConnection, middleware} = createKoaHttpMiddleware(() => "1")
app.use(middleware)

const httpServer = {
  onError,
  onConnection,
  close(cb) {
    server.close(cb)
  },
}

createRpcServer(services, httpServer, {
  listeners: {
    connected: (remoteId, connections) => {},
    disconnected: (remoteId, connections) => {},
    messageIn: (remoteId, data) => {
      console.debug("RPC in", data)
    },
    messageOut: (remoteId, data) => {
      console.debug("RPC out", data)
    },
    subscribed: subscriptions => {},
    unsubscribed: subscriptions => {},
  },
})

console.log("RPC Server started at http://localhost:5555/rpc")
