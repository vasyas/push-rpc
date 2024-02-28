import {log} from "../logger.js"
import {safeParseJson} from "../utils/json.js"
import {adelay} from "../utils/promises.js"
import {environment, Environment} from "../utils/env.js"
import {ClientCookies} from "../utils/cookies.js"
import type {IncomingMessage} from "http"

export class WebSocketConnection {
  constructor(
    private readonly url: string,
    private readonly clientId: string,
    private readonly cookies: ClientCookies,
    private readonly options: {
      subscriptions: boolean
      reconnectDelay: number
      errorDelayMaxDuration: number
      pingInterval: number | null
    },
    private readonly consume: (itemName: string, parameters: unknown[], data: unknown) => void,
    private readonly onConnected: () => void,
    private readonly onDisconnected: () => void
  ) {
    this.clientId = clientId
  }

  private resolveClose = () => {}

  async close() {
    this.disconnectedMark = true

    if (this.socket) {
      this.socket!.close()

      return new Promise<void>((resolve, reject) => {
        this.resolveClose = resolve
      })
    }
  }

  private waitConnectionPromise: Promise<void> | undefined

  /**
   * Connect to the server, on each disconnect try to disconnect.
   * Resolves at next successful connect. Reconnection loop continues even after resolution
   * Never rejects
   */
  connect() {
    // no subscriptions support, no need to connect
    if (!this.options.subscriptions) {
      return Promise.resolve()
    }

    // already started connecting
    if (this.waitConnectionPromise) return this.waitConnectionPromise

    // start connection process

    let resolveConnectionPromise: () => void
    let errorDelay = 0

    this.waitConnectionPromise = new Promise(async (resolve) => {
      resolveConnectionPromise = resolve

      while (true) {
        // connect, and wait for ...
        await new Promise<void>((resolve) => {
          const connectionPromise = this.establishConnection(() => {
            // 1. ...disconnected

            // recreate promise so new clients will wait for new connection
            this.waitConnectionPromise = new Promise(
              (resolve) => (resolveConnectionPromise = resolve)
            )

            resolve()
          })

          connectionPromise.then(
            () => {
              // first reconnect after successful connection is done without delay
              errorDelay = 0

              resolveConnectionPromise()
            },
            (e) => {
              log.warn("Unable to connect WS", e)

              // 2. ... unable to establish connection
              resolve()
            }
          )
        })

        // disconnected while connecting?
        if (this.disconnectedMark) {
          return
        }

        await adelay(this.options.reconnectDelay + errorDelay)

        // disconnected while waiting?
        if (this.disconnectedMark) {
          return
        }

        errorDelay = Math.round(Math.random() * this.options.errorDelayMaxDuration)
      }
    })

    return this.waitConnectionPromise
  }

  public isConnected() {
    return this.socket !== null
  }

  /**
   * Connect this to server
   *
   * Resolves on successful connection, rejects on connection error or connection timeout
   */
  private async establishConnection(onDisconnected: () => void): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        let socket: WebSocket

        if ([Environment.ReactNative, Environment.Node].includes(environment)) {
          // use RN WS or node-ws headers extensions to set cookie
          let options = undefined

          const cookie = this.cookies.getCookieString()
          if (cookie) {
            options = {
              headers: {
                Cookie: cookie,
              },
            }
          }

          socket = new (WebSocket as any)(this.url, this.clientId, options)
        } else {
          // rely on browser cookie handling
          socket = new WebSocket(this.url, this.clientId)
        }

        let connected = false

        socket.addEventListener("open", () => {
          this.socket = socket
          connected = true
          resolve()

          this.heartbeat()

          this.onConnected()
        })

        socket.addEventListener("ping", () => {
          this.heartbeat()
        })

        socket.addEventListener("close", () => {
          this.socket = null

          if (connected) {
            onDisconnected()
            this.onDisconnected()
          }

          if (this.pingTimeout) {
            clearTimeout(this.pingTimeout)
          }

          this.resolveClose()
        })

        socket.addEventListener("error", (e) => {
          if (!connected) {
            reject(e)
          }

          try {
            socket.close()
          } catch (e) {
            // ignore
          }
        })

        socket.addEventListener("message", (message) => {
          this.receiveSocketMessage(message.data)
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  private socket: WebSocket | null = null
  private disconnectedMark = false
  private pingTimeout: NodeJS.Timeout | null = null

  private heartbeat() {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
    }

    if (this.options.pingInterval) {
      this.pingTimeout = setTimeout(() => {
        this.socket?.close()
      }, this.options.pingInterval * 1.5)
    }
  }

  private async receiveSocketMessage(rawMessage: string | ArrayBuffer | Blob) {
    try {
      const msg = rawMessage.toString()

      const [itemName, data, ...parameters] = safeParseJson(msg)

      this.consume(itemName, parameters, data)
    } catch (e) {
      log.warn("Invalid message received", e)
    }
  }

  // test-only
  _webSocket() {
    return this.socket
  }
}
