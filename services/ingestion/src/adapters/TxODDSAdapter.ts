import type { SourceAdapter, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { TxOddsIngestionConfig } from '../config.js'
import { updateHealth } from '../health.js'
import { markDropped, markReconnect } from '../stats.js'
import type { UnifiedStreamWriter } from '../unified-stream.js'
import {
  fetchGuestJwt,
  resolveTxOddsCredentials,
  txOddsAuthHeaders,
  type TxOddsCredentials,
} from '../txodds/auth.js'
import { FixtureCache } from '../txodds/fixture-cache.js'
import { normalizeTxOddsPacket } from '../txodds/normalize-txodds.js'
import { parseSseData, readSseMessages } from '../txodds/sse-client.js'
import type { TxOddsOddsPayload, TxOddsScoresPayload, TxOddsStreamKind } from '../txodds/types.js'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * TxLINE SSE → UnifiedSignal ingestion (Prompt 2).
 * Scores + StablePrice odds streams with reconnect/backoff and fixture label cache.
 */
export class TxODDSAdapter implements SourceAdapter {
  readonly sourceTag = 'txodds' as const

  private config: TxOddsIngestionConfig
  private writer: UnifiedStreamWriter
  private fixtureCache = new FixtureCache()
  private stopped = false
  private abortControllers = new Set<AbortController>()
  private credentials: TxOddsCredentials | null = null
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private streamState: { scores: boolean; odds: boolean } = { scores: false, odds: false }

  constructor(config: TxOddsIngestionConfig, writer: UnifiedStreamWriter) {
    this.config = config
    this.writer = writer
  }

  async start(emit: (signal: UnifiedSignal) => Promise<void>): Promise<void> {
    this.stopped = false
    this.credentials = await resolveTxOddsCredentials(this.config)

    try {
      await this.fixtureCache.refresh(this.credentials)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fixture cache refresh failed'
      console.warn('[TxODDSAdapter] fixture cache refresh failed — labels may be generic', { error: msg })
    }

    this.patchHealth()
    this.refreshTimer = setInterval(() => {
      void this.refreshFixtures()
    }, this.config.fixtureRefreshMs)

    const tasks: Promise<void>[] = []
    if (this.config.streamMode === 'scores' || this.config.streamMode === 'both') {
      tasks.push(this.runStreamLoop('scores', emit))
    }
    if (this.config.streamMode === 'odds' || this.config.streamMode === 'both') {
      tasks.push(this.runStreamLoop('odds', emit))
    }

    await Promise.all(tasks)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
    for (const ac of this.abortControllers) ac.abort()
    this.abortControllers.clear()
    this.streamState = { scores: false, odds: false }
    this.patchHealth()
  }

  private patchHealth(): void {
    updateHealth({
      txodds: {
        connected: this.streamState.scores || this.streamState.odds,
        streamMode: this.config.streamMode,
        fixturesCached: this.fixtureCache.size(),
        streams: { ...this.streamState },
        apiOrigin: this.config.apiOrigin,
      },
    })
  }

  private async refreshFixtures(): Promise<void> {
    if (!this.credentials || this.stopped) return
    try {
      await this.fixtureCache.refresh(this.credentials)
      this.patchHealth()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fixture refresh failed'
      console.warn('[TxODDSAdapter] periodic fixture refresh failed', { error: msg })
    }
  }

  private async runStreamLoop(
    kind: TxOddsStreamKind,
    emit: (signal: UnifiedSignal) => Promise<void>,
  ): Promise<void> {
    let backoffMs = this.config.reconnectBaseMs

    while (!this.stopped) {
      try {
        await this.consumeStream(kind, emit)
        backoffMs = this.config.reconnectBaseMs
      } catch (e) {
        if (this.stopped) break
        const msg = e instanceof Error ? e.message : 'stream error'
        markReconnect()
        console.error('[TxODDSAdapter] stream disconnected', { kind, error: msg })
        this.streamState[kind] = false
        this.patchHealth()
        await sleep(backoffMs)
        backoffMs = Math.min(backoffMs * 2, this.config.reconnectMaxMs)
      }
    }
  }

  private async consumeStream(
    kind: TxOddsStreamKind,
    emit: (signal: UnifiedSignal) => Promise<void>,
  ): Promise<void> {
    const creds = this.credentials ?? (await resolveTxOddsCredentials(this.config))
    this.credentials = creds

    const path = kind === 'scores' ? '/api/scores/stream' : '/api/odds/stream'
    const ac = new AbortController()
    this.abortControllers.add(ac)

    try {
      const res = await fetch(`${creds.apiOrigin}${path}`, {
        headers: txOddsAuthHeaders(creds),
        signal: ac.signal,
      })

      if (res.status === 401) {
        creds.jwt = await fetchGuestJwt(creds.apiOrigin)
        throw new Error('JWT expired — refreshed, reconnecting')
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`TxLINE ${kind} stream failed (${res.status}): ${body || res.statusText}`)
      }

      this.streamState[kind] = true
      this.patchHealth()
      console.info('[TxODDSAdapter] stream connected', { kind })

      for await (const message of readSseMessages(res)) {
        if (this.stopped) break
        const parsed = parseSseData(message.data)
        await this.handlePayload(kind, parsed, emit)
      }

      if (!this.stopped) {
        throw new Error(`${kind} stream ended`)
      }
    } finally {
      this.abortControllers.delete(ac)
      this.streamState[kind] = false
      this.patchHealth()
    }
  }

  private async handlePayload(
    kind: TxOddsStreamKind,
    parsed: unknown,
    emit: (signal: UnifiedSignal) => Promise<void>,
  ): Promise<void> {
    if (!isRecord(parsed)) return

    const packet =
      kind === 'scores'
        ? ({ kind: 'scores' as const, payload: parsed as TxOddsScoresPayload })
        : ({ kind: 'odds' as const, payload: parsed as TxOddsOddsPayload })

    const fixtureId =
      kind === 'scores'
        ? (packet.payload as TxOddsScoresPayload).fixtureId
        : (packet.payload as TxOddsOddsPayload).FixtureId

    if (this.config.fixtureIds?.length && !this.config.fixtureIds.includes(fixtureId)) {
      return
    }

    const signal = normalizeTxOddsPacket(packet, this.fixtureCache.get(fixtureId))
    if (!signal) return

    try {
      const streamId = await this.writer.xaddUnified(signal)
      if (streamId === null && !signal.dropped) return
      await emit(signal)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'normalize/xadd failed'
      markDropped(msg)
      console.error('[TxODDSAdapter] handle payload', { kind, error: msg, fixtureId })
    }
  }
}
