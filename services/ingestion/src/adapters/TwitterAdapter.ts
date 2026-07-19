import type { RawMessage, SourceAdapter, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { TwitterIngestionConfig } from '../config.js'
import { updateHealth } from '../health.js'
import { normalizeTwitterMessage } from '../parser/normalize-twitter.js'
import { markDropped } from '../stats.js'
import { chunkHandles, searchRecentTweets } from '../twitter/client.js'
import { resolveTwitterHandleList } from '../twitter/resolve-handles.js'
import type { UnifiedStreamWriter } from '../unified-stream.js'

/**
 * X (Twitter) → UnifiedSignal via recent-search poll (app-only bearer).
 * PUBLIC handles only; CA extraction reuses the Telegram token parse path.
 */
export class TwitterAdapter implements SourceAdapter {
  readonly sourceTag = 'twitter' as const

  private config: TwitterIngestionConfig
  private writer: UnifiedStreamWriter
  private handles: string[] = []
  private sinceByChunk = new Map<string, string>()
  private timer: ReturnType<typeof setInterval> | null = null
  private stopped = false
  private pollInFlight = false

  constructor(config: TwitterIngestionConfig, writer: UnifiedStreamWriter) {
    this.config = config
    this.writer = writer
  }

  async start(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    this.handles = this.config.handles.length > 0 ? this.config.handles : await resolveTwitterHandleList()
    updateHealth({
      twitter: {
        connected: true,
        handleCount: this.handles.length,
        lastPollAt: null,
        lastError: null,
      },
    })

    if (this.handles.length === 0) {
      console.warn('[TwitterAdapter] no handles configured — set TWITTER_HANDLES or enroll platform=twitter rows')
    } else {
      console.info('[TwitterAdapter] watching handles', { count: this.handles.length })
    }

    // Non-blocking poll loop — adapter.start must not hang the ingestion boot.
    void this.pollOnce(emit)
    this.timer = setInterval(() => void this.pollOnce(emit), this.config.pollIntervalMs)
  }

  private async pollOnce(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    if (this.stopped || this.pollInFlight) return
    this.pollInFlight = true
    try {
      // Refresh allowlist periodically (handles mutate via scout).
      if (this.config.handles.length === 0) {
        this.handles = await resolveTwitterHandleList()
      }

      const chunks = chunkHandles(this.handles)
      let emitted = 0
      for (const chunk of chunks) {
        if (this.stopped) break
        const key = chunk.join(',')
        const sinceId = this.sinceByChunk.get(key)
        try {
          const { tweets, newestId } = await searchRecentTweets({
            bearerToken: this.config.bearerToken,
            handles: chunk,
            sinceId,
            maxResults: this.config.maxResults,
          })
          if (newestId) this.sinceByChunk.set(key, newestId)

          // Oldest first so feed order matches time when multiple CA hits.
          for (const tweet of [...tweets].reverse()) {
            const raw: RawMessage = {
              channel: `@${tweet.username}`,
              messageId: tweet.id,
              text: tweet.text,
              entities: [],
              eventType: 'new',
              ts: tweet.created_at ?? new Date().toISOString(),
              ingestTs: new Date().toISOString(),
            }
            const signal = await normalizeTwitterMessage(raw)
            if (!signal) continue

            const streamId = await this.writer.xaddUnified(signal)
            if (streamId === null && !signal.dropped) continue
            await emit(signal)
            emitted += 1
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'poll failed'
          markDropped(`twitter:${msg}`)
          console.error('[TwitterAdapter] poll chunk failed', { handles: chunk.length, error: msg })
          updateHealth({
            twitter: {
              connected: true,
              handleCount: this.handles.length,
              lastPollAt: new Date().toISOString(),
              lastError: msg,
            },
          })
        }
      }

      updateHealth({
        twitter: {
          connected: true,
          handleCount: this.handles.length,
          lastPollAt: new Date().toISOString(),
          lastError: null,
        },
      })
      if (emitted > 0) {
        console.info('[TwitterAdapter] poll emitted', { emitted, handles: this.handles.length })
      }
    } finally {
      this.pollInFlight = false
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
