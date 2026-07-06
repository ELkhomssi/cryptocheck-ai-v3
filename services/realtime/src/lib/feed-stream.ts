import { SIGNAL_STREAM_FEED, SIGNAL_LATENCY_CONTRACT, type SignalFeedEvent } from '@cryptocheck/signal-contracts'
import { upstashCommand } from './redis.js'

type FeedStreamTuple = [string, [string, string[]][]]

const CURSOR_KEY = 'ccai:sig:realtime:feed-cursor'

function parseFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const k = fields[i]
    const v = fields[i + 1]
    if (k != null && v != null) out[k] = v
  }
  return out
}

export type FeedListener = (event: SignalFeedEvent, streamId: string) => void

export class FeedStreamReader {
  private lastId = '$'
  private running = false
  private listeners = new Set<FeedListener>()

  subscribe(listener: FeedListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    const saved = await upstashCommand<string | null>('GET', CURSOR_KEY).catch(() => null)
    if (saved && saved !== '$') this.lastId = saved

    void this.loop()
  }

  stop(): void {
    this.running = false
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const readId = this.lastId === '$' ? '$' : `(${this.lastId}`
        const result = await upstashCommand<FeedStreamTuple[] | null>(
          'XREAD',
          'COUNT',
          50,
          'BLOCK',
          3000,
          'STREAMS',
          SIGNAL_STREAM_FEED,
          readId,
        )

        if (!result?.length) continue

        for (const [, messages] of result) {
          for (const [id, fields] of messages) {
            this.lastId = id
            const data = parseFields(fields).data
            if (!data) continue
            try {
              const event = JSON.parse(data) as SignalFeedEvent
              for (const fn of this.listeners) fn(event, id)
            } catch {
              /* skip malformed */
            }
          }
        }

        if (this.lastId !== '$') {
          await upstashCommand('SET', CURSOR_KEY, this.lastId, 'EX', 3600)
        }
      } catch (e) {
        console.error('[signal-realtime] feed stream read error', e instanceof Error ? e.message : e)
        await new Promise((r) => setTimeout(r, SIGNAL_LATENCY_CONTRACT.wsCoalesceMsMax))
      }
    }
  }
}
