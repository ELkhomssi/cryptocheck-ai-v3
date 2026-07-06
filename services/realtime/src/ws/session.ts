import type { WebSocket } from 'ws'
import type { SignalFeedEvent, SignalFeedFilter, SignalSubscriptionTier } from '@cryptocheck/signal-contracts'
import { SIGNAL_LATENCY_CONTRACT } from '@cryptocheck/signal-contracts'
import { effectiveFilter, matchesFilter } from '../lib/filters.js'

const FREE_DELAY_MS = Number(process.env.SIGNAL_FREE_DELAY_MS ?? 90_000)
const COALESCE_MS = Number(
  process.env.SIGNAL_WS_COALESCE_MS ?? SIGNAL_LATENCY_CONTRACT.wsCoalesceMsMin,
)
const MAX_BUFFER_BYTES = Number(process.env.SIGNAL_WS_MAX_BUFFER ?? 512 * 1024)

type Delayed = { deliverAt: number; event: SignalFeedEvent }

export class WsClientSession {
  readonly id: string
  tier: SignalSubscriptionTier = 'free'
  filter: SignalFeedFilter = {}
  private pending = new Map<string, SignalFeedEvent>()
  private delayQueue: Delayed[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private delayTimer: NodeJS.Timeout | null = null

  constructor(
    readonly ws: WebSocket,
    id: string,
  ) {
    this.id = id
  }

  get activeFilter(): SignalFeedFilter {
    return this.filter
  }

  setSubscription(tier: SignalSubscriptionTier, filter: SignalFeedFilter): void {
    this.tier = tier
    this.filter = effectiveFilter(tier, filter)
  }

  enqueue(event: SignalFeedEvent): void {
    if (!matchesFilter(event, this.filter)) return

    if (this.tier === 'free') {
      this.delayQueue.push({ event, deliverAt: Date.now() + FREE_DELAY_MS })
      this.scheduleDelayFlush()
      return
    }

    this.coalesce(event)
  }

  private coalesce(event: SignalFeedEvent): void {
    const key =
      event.type === 'signal.remove'
        ? `remove:${event.id}`
        : event.type === 'batch'
          ? `batch:${Date.now()}`
          : `signal:${event.signal.id}`

    this.pending.set(key, event)
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), COALESCE_MS)
    }
  }

  private scheduleDelayFlush(): void {
    if (this.delayTimer) return
    this.delayTimer = setTimeout(() => {
      this.delayTimer = null
      const now = Date.now()
      const ready: SignalFeedEvent[] = []
      const rest: Delayed[] = []
      for (const item of this.delayQueue) {
        if (item.deliverAt <= now) ready.push(item.event)
        else rest.push(item)
      }
      this.delayQueue = rest
      for (const event of ready) this.coalesce(event)
      if (this.delayQueue.length) this.scheduleDelayFlush()
    }, Math.min(FREE_DELAY_MS, 5000))
  }

  private flush(): void {
    this.flushTimer = null
    if (this.ws.readyState !== this.ws.OPEN) {
      this.pending.clear()
      return
    }

    if (this.ws.bufferedAmount > MAX_BUFFER_BYTES) {
      const latest = new Map<string, SignalFeedEvent>()
      for (const event of this.pending.values()) {
        if (event.type === 'signal.new' || event.type === 'signal.update') {
          latest.set(event.signal.id, event)
        }
      }
      this.pending.clear()
      for (const event of latest.values()) {
        if (event.type === 'signal.new' || event.type === 'signal.update') {
          this.pending.set(`signal:${event.signal.id}`, event)
        }
      }
    }

    const events = [...this.pending.values()]
    this.pending.clear()
    if (!events.length) return

    const payload: SignalFeedEvent =
      events.length === 1
        ? events[0]!
        : { type: 'batch', events, coalescedAt: new Date().toISOString() }

    this.ws.send(JSON.stringify(payload))
  }

  close(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    if (this.delayTimer) clearTimeout(this.delayTimer)
    this.pending.clear()
    this.delayQueue = []
  }
}
