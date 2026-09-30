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
      throw new Error("Invalid reconnectPolicy.firstReconnectDelayMs")
    }
    // Every window must be positive, representable as a timer, and ordered
    // minDelayMs <= maxDelayMs <= maxBackoffMs.
    const invalid = (key: keyof ReconnectPolicy) => new Error(`Invalid reconnectPolicy.${key}`)

    if (policy.maxDelayMs <= 0) throw invalid("maxDelayMs")
    if (policy.connectTimeoutMs <= 0 || policy.connectTimeoutMs > MAX_TIMER_DELAY_MS) {
      throw invalid("connectTimeoutMs")
    }
    if (policy.stableConnectionMs <= 0 || policy.stableConnectionMs > MAX_TIMER_DELAY_MS) {
      throw invalid("stableConnectionMs")
    }
    if (policy.backoffFactor < 1) throw invalid("backoffFactor")
    if (policy.maxDelayMs < policy.minDelayMs) throw invalid("minDelayMs")
    if (policy.maxBackoffMs < policy.maxDelayMs || policy.maxBackoffMs > MAX_TIMER_DELAY_MS) {
      throw invalid("maxBackoffMs")
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
    // Suspension is not another failed attempt, so an overdue timer re-draws from
    // the same retry window rather than widening it.
    this.scheduleOverdueAware(
      () =>
        firstDelay ??
        this.policy.minDelayMs + this.clock.random() * (ceiling - this.policy.minDelayMs),
      (timer) => (this.timer = timer),
      () => this.finishWait(true),
    )
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
    // Time spent suspended does not demonstrate a stable connection.
    this.scheduleOverdueAware(
      () => this.policy.stableConnectionMs,
      (timer) => (this.stableTimer = timer),
      () => {
        this.stableTimer = null
        this.attempt = 0
        this.useFirstReconnectDelay = this.policy.firstReconnectDelayMs !== undefined
      },
    )
  }

  /**
   * Run `onDue` once the delay has genuinely elapsed. A callback that arrives
   * substantially late means the application was suspended, so the wait restarts
   * instead of firing; both timers in this class need that same treatment.
   */
  private scheduleOverdueAware(
    getDelay: () => number,
    assign: (timer: Timer) => void,
    onDue: () => void,
  ) {
    const schedule = () => {
      const delay = getDelay()
      const due = this.clock.now() + delay
      assign(
        this.clock.setTimeout(() => {
          if (this.clock.now() - due > OVERDUE_TOLERANCE_MS) {
            schedule()
            return
          }
          onDue()
        }, delay),
      )
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
