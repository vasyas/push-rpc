import type {ReconnectPolicy} from "./index.js"

type Timer = ReturnType<typeof setTimeout>
export type ReconnectRuntime = {
  now(): number
  random(): number
  setTimeout(callback: () => void, delay: number): Timer
  clearTimeout(timer: Timer): void
}
const runtime: ReconnectRuntime = {
  now: () => Date.now(),
  random: () => Math.random(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
}

// Small scheduling delays are normal; a substantially overdue callback can mean
// the application was suspended along with thousands of other clients.
const OVERDUE_TOLERANCE_MS = 1000
// Larger delays overflow setTimeout in both browsers and Node.
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1

/** One recovery timer, shared by transport failures and application recovery signals. */
export class ReconnectScheduler {
  constructor(
    private readonly policy: ReconnectPolicy,
    private readonly clock: ReconnectRuntime = runtime,
  ) {
    for (const key of [
      "minDelayMs",
      "maxDelayMs",
      "backoffFactor",
      "maxBackoffMs",
      "stableConnectionMs",
      "connectTimeoutMs",
    ] as const) {
      const value = policy[key]
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid reconnectPolicy.${key}`)
      }
    }
    const firstDelay = policy.firstReconnectDelayMs
    if (
      firstDelay !== undefined &&
      (!Number.isFinite(firstDelay) || firstDelay < 0 || firstDelay > MAX_TIMER_DELAY_MS)
    ) {
      throw new Error("Invalid reconnectPolicy delay bounds")
    }
    for (const key of ["maxBackoffMs", "connectTimeoutMs", "stableConnectionMs"] as const) {
      if (policy[key] > MAX_TIMER_DELAY_MS) {
        throw new Error("Invalid reconnectPolicy delay bounds")
      }
    }
    if (
      policy.maxDelayMs <= 0 ||
      policy.maxDelayMs < policy.minDelayMs ||
      policy.maxBackoffMs < policy.maxDelayMs ||
      policy.backoffFactor < 1 ||
      policy.connectTimeoutMs <= 0 ||
      policy.stableConnectionMs <= 0
    ) {
      throw new Error("Invalid reconnectPolicy delay bounds")
    }
  }

  private attempt = 0
  private useFirstReconnectDelay = false
  private pending: {promise: Promise<boolean>; finish: (run: boolean) => void} | null = null
  private timer: Timer | null = null
  private stableTimer: Timer | null = null

  wait(): Promise<boolean> {
    if (this.pending) return this.pending.promise
    const ceiling = Math.min(
      this.policy.maxBackoffMs,
      this.policy.maxDelayMs * this.policy.backoffFactor ** this.attempt,
    )
    const firstDelay = this.useFirstReconnectDelay ? this.policy.firstReconnectDelayMs : undefined
    this.useFirstReconnectDelay = false
    if (firstDelay === undefined) this.attempt = Math.min(this.attempt + 1, 1024)
    let finish!: (run: boolean) => void
    const promise = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    this.pending = {promise, finish}
    const schedule = () => {
      const delay =
        firstDelay ??
        this.policy.minDelayMs + this.clock.random() * (ceiling - this.policy.minDelayMs)
      const due = this.clock.now() + delay
      this.timer = this.clock.setTimeout(() => {
        if (this.clock.now() - due > OVERDUE_TOLERANCE_MS) {
          // Use the same retry window. Suspension is not another failed attempt.
          schedule()
          return
        }
        this.finishWait(true)
      }, delay)
    }
    schedule()
    return promise
  }

  /** A new explicit recovery signal starts now; a failed attempt uses the base retry window. */
  expedite() {
    this.disconnected()
    this.attempt = 0
    this.useFirstReconnectDelay = false
    this.finishWait(true)
  }

  connected() {
    this.disconnected()
    const schedule = () => {
      const due = this.clock.now() + this.policy.stableConnectionMs
      this.stableTimer = this.clock.setTimeout(() => {
        // Time spent suspended does not demonstrate a stable connection.
        if (this.clock.now() - due > OVERDUE_TOLERANCE_MS) {
          schedule()
          return
        }
        this.stableTimer = null
        this.attempt = 0
        this.useFirstReconnectDelay = this.policy.firstReconnectDelayMs !== undefined
      }, this.policy.stableConnectionMs)
    }
    schedule()
  }

  disconnected() {
    if (this.stableTimer !== null) this.clock.clearTimeout(this.stableTimer)
    this.stableTimer = null
  }

  cancel() {
    this.disconnected()
    this.finishWait(false)
  }

  private finishWait(run: boolean) {
    if (this.timer !== null) this.clock.clearTimeout(this.timer)
    this.timer = null
    const pending = this.pending
    this.pending = null
    pending?.finish(run)
  }
}
