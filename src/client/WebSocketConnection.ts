import {log} from "../logger.js"
import {safeParseJson} from "../utils/json.js"
import {adelay} from "../utils/promises.js"
import {PING_MSG, PONG_MSG} from "../rpc.js"
import type {ReconnectPolicy} from "./index.js"
import {ReconnectScheduler} from "./ReconnectScheduler.js"

// A dead peer may never acknowledge close(); stop waiting for that handshake.
const CLOSE_TIMEOUT = 10 * 1000

export class WebSocketConnection {
  constructor(
    private readonly url: string,
    private readonly clientId: string,
    private readonly options: {
      subscriptions: boolean
      reconnectDelay: number
      errorDelayMaxDuration: number
      pingInterval: number | null
      reconnectPolicy?: ReconnectPolicy
    },
    private readonly consume: (
      itemName: string,
      parameters: unknown[],
      data: unknown,
    ) => Promise<unknown>,
    private readonly onConnected: () => void,
    private readonly onDisconnected: () => void,
  ) {
    this.clientId = clientId
    this.reconnectScheduler = options.reconnectPolicy
      ? new ReconnectScheduler(options.reconnectPolicy)
      : null
  }

  private resolveClose = () => {}
  private readonly reconnectScheduler: ReconnectScheduler | null
  // Covers both the retry delay and its opening handshake, until OPEN succeeds.
  private recoveryPending = false

  async close() {
    this.disconnectedMark = true
    this.reconnectScheduler?.cancel()
    this.cancelReconnectDelay?.()

    if (this.socket || this.pendingSocket) {
      return new Promise<void>((resolve) => {
        this.resolveClose = resolve
        this.closeSocket(true)
      })
    }
  }

  /** Abandon the current attempt immediately, preserving the reconnect loop. */
  reconnect(options: {immediate?: boolean} = {}) {
    if (this.disconnectedMark || !this.options.subscriptions) return

    if (options.immediate) {
      // An opening socket is already doing the requested recovery. Its bounded
      // handshake timer must not be restarted by duplicate foreground/network events.
      if (this.pendingSocket || this.reconnectRequested) return
      this.reconnectRequested = true
      this.recoveryPending = true
      this.reconnectScheduler?.expedite()
      this.cancelReconnectDelay?.()
    } else if (this.reconnectScheduler) {
      // Lifecycle/network duplicates cannot interrupt an already scheduled recovery
      // or its opening handshake. The handshake has its own bounded timeout.
      if (this.recoveryPending) return
      this.recoveryPending = true
    } else {
      this.reconnectRequested = true
      this.cancelReconnectDelay?.()
    }

    const socket = this.socket || this.pendingSocket
    if (socket) this.abortSocket(socket, this.abandonSocket)
    void this.connect()
  }

  /** Logical disconnection must precede native close, which can hang or emit callbacks. */
  private abortSocket(socket: WebSocket, onClosed: (() => void) | null) {
    onClosed?.()
    try {
      const terminate = (socket as WebSocket & {terminate?: () => void}).terminate
      if (terminate) terminate.call(socket)
      else socket.close()
    } catch {
      // The socket is already abandoned; its late callbacks are ignored.
    }
  }

  /** Try the close handshake on shutdown, but bound how long it may block cleanup. */
  private closeSocket(graceful: boolean) {
    const socket = this.socket || this.pendingSocket

    if (!socket) return

    const abandon = this.abandonSocket
    const terminate = (socket as WebSocket & {terminate?: () => void}).terminate?.bind(socket)

    if (!graceful && terminate) {
      terminate()
      return
    }

    try {
      socket.close()
    } catch (e) {
      // ignore
    }

    const timer = setTimeout(() => {
      // 'close' already handled, nothing to do
      if (this.socket !== socket && this.pendingSocket !== socket) return

      if (terminate) {
        terminate()
      } else {
        abandon?.()
      }
    }, testCloseTimeout ?? CLOSE_TIMEOUT)

    // don't keep the Node process alive because of the fallback timer
    timer.unref?.()
  }

  private waitConnectionPromise: Promise<void> | undefined

  /** Wait for the next successful connection; one retry loop owns all later attempts. */
  connect() {
    if (!this.options.subscriptions || this.disconnectedMark) return Promise.resolve()
    if (this.waitConnectionPromise) return this.waitConnectionPromise

    this.waitConnectionPromise = new Promise((resolve) => {
      void this.runConnectionLoop(resolve)
    })
    return this.waitConnectionPromise
  }

  private async runConnectionLoop(resolveNextConnection: () => void) {
    let errorDelay = 0
    if (
      this.reconnectScheduler &&
      (this.options.reconnectPolicy?.spreadInitialConnect || this.recoveryPending)
    ) {
      this.recoveryPending = true
      if (!this.reconnectRequested && !(await this.reconnectScheduler.wait())) return
    }
    this.reconnectRequested = false

    while (true) {
      // Callers wait for OPEN; this loop waits for CLOSE or an opening failure.
      await new Promise<void>((finishAttempt) => {
        const connectionPromise = this.establishConnection(() => {
          // After disconnection, new connect() callers wait for the replacement.
          this.waitConnectionPromise = new Promise((resolve) => (resolveNextConnection = resolve))

          finishAttempt()
        })

        connectionPromise.then(
          () => {
            // Legacy retries add jitter only after a failed attempt.
            errorDelay = 0

            resolveNextConnection()
          },
          (e) => {
            if (!this.reconnectRequested && !this.disconnectedMark) {
              log.warn("Unable to connect WS", e)
            }

            finishAttempt()
          },
        )
      })

      // close() stops the loop, including while a handshake or retry was pending.
      if (this.disconnectedMark) {
        return
      }

      if (this.reconnectScheduler) {
        this.recoveryPending = true
        if (!this.reconnectRequested && !(await this.reconnectScheduler.wait())) return
      } else if (!this.reconnectRequested) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer)
            this.cancelReconnectDelay = null
            resolve()
          }
          const timer = setTimeout(finish, this.options.reconnectDelay + errorDelay)
          this.cancelReconnectDelay = finish
        })
      }
      this.reconnectRequested = false

      if (this.disconnectedMark) {
        return
      }

      errorDelay = Math.round(Math.random() * this.options.errorDelayMaxDuration)
    }
  }

  public isConnected() {
    return this.socket !== null
  }

  /** Open one socket; reject if it closes, errors, or times out before OPEN. */
  private async establishConnection(onDisconnected: () => void): Promise<void> {
    if (testWebSocketConnectionDelay) await adelay(testWebSocketConnectionDelay)
    if (this.disconnectedMark) throw new Error("Connection closed")

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.url, this.clientId)
      this.pendingSocket = socket

      let connected = false
      let closed = false
      let connectTimer: ReturnType<typeof setTimeout> | undefined

      // Native CLOSE and explicit abandonment share this one idempotent cleanup.
      const handleClosed = () => {
        if (closed) return
        closed = true
        clearTimeout(connectTimer)
        this.reconnectScheduler?.disconnected()

        if (this.socket === socket) {
          this.socket = null
        }
        if (this.pendingSocket === socket) {
          this.pendingSocket = null
        }

        if (this.abandonSocket === handleClosed) {
          this.abandonSocket = null
        }

        if (this.pingTimeout) {
          clearTimeout(this.pingTimeout)
          this.pingTimeout = null
        }

        if (connected) {
          onDisconnected()
          this.onDisconnected()
        } else {
          reject(new Error("WebSocket closed before connecting"))
        }

        this.resolveClose()
      }
      this.abandonSocket = handleClosed

      socket.addEventListener("open", () => {
        if (closed) return
        this.pendingSocket = null
        this.socket = socket
        connected = true
        clearTimeout(connectTimer)
        this.recoveryPending = false
        this.reconnectScheduler?.connected()
        resolve()

        this.heartbeat()

        this.onConnected()
      })

      socket.addEventListener("close", handleClosed)

      socket.addEventListener("error", (e) => {
        if (closed) return
        if (!connected) reject(e)
        handleClosed()

        try {
          socket.close()
        } catch (e) {
          // ignore
        }
      })

      if (this.options.reconnectPolicy) {
        connectTimer = setTimeout(() => {
          this.abortSocket(socket, handleClosed)
        }, this.options.reconnectPolicy.connectTimeoutMs)
      }

      socket.addEventListener("message", (message) => {
        // late message from an abandoned socket
        if (closed) return

        this.heartbeat()

        if (message.data === PING_MSG) {
          socket.send(PONG_MSG)
          return
        }

        this.receiveSocketMessage(message.data)
      })
    })
  }

  private socket: WebSocket | null = null
  private pendingSocket: WebSocket | null = null
  private abandonSocket: (() => void) | null = null
  private cancelReconnectDelay: (() => void) | null = null
  private reconnectRequested = false
  private disconnectedMark = false
  private pingTimeout: NodeJS.Timeout | null = null

  private heartbeat() {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
    }

    if (this.options.pingInterval) {
      this.pingTimeout = setTimeout(() => {
        // no pings from the server - the connection is considered dead,
        // no point in a graceful closing handshake
        if (this.reconnectScheduler) this.reconnect()
        else this.closeSocket(false)
      }, this.options.pingInterval * 1.5)
    }
  }

  private async receiveSocketMessage(rawMessage: string | ArrayBuffer | Blob) {
    try {
      const msg = rawMessage.toString()

      const [itemName, data, ...parameters] = safeParseJson(msg)

      await this.consume(itemName, parameters, data)
    } catch (e) {
      log.error("Can't handle notification", e)
    }
  }

  // test-only
  _webSocket() {
    return this.socket
  }
}

let testWebSocketConnectionDelay = 0

export function setTestWebSocketConnectionDelay(ms: number) {
  testWebSocketConnectionDelay = ms
}

let testCloseTimeout: number | null = null

export function setTestCloseTimeout(ms: number | null) {
  testCloseTimeout = ms
}
