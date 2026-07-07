import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { IngestionConfig } from './config.js'
import { getStats } from './stats.js'
import type { UnifiedStreamWriter } from './unified-stream.js'

export type HealthSnapshot = {
  status: 'ok' | 'degraded' | 'down'
  service: 'signal-ingestion'
  sources: string[]
  telegram: {
    connected: boolean
    authorized: boolean
    channelsJoined: number
    sessionIndex: number
    sessionCount: number
  } | null
  txodds: {
    connected: boolean
    streamMode: string
    fixturesCached: number
    streams: { scores: boolean; odds: boolean }
    apiOrigin: string
  } | null
  stream: string
  streams: { unified: string; sources: Record<string, string> }
  stats: ReturnType<typeof getStats>
  config: {
    channelsConfigPath?: string
    channelShard?: string[]
  }
}

let snapshot: HealthSnapshot = {
  status: 'down',
  service: 'signal-ingestion',
  sources: [],
  telegram: null,
  txodds: null,
  stream: '',
  streams: { unified: '', sources: {} },
  stats: getStats(),
  config: {},
}

export function updateHealth(patch: Partial<HealthSnapshot>): void {
  const next: HealthSnapshot = { ...snapshot, ...patch, stats: getStats() }

  const telegramOk = !next.telegram || (next.telegram.connected && next.telegram.authorized)
  const txoddsOk =
    !next.txodds ||
    (next.txodds.streamMode === 'both'
      ? next.txodds.streams.scores && next.txodds.streams.odds
      : next.txodds.streamMode === 'scores'
        ? next.txodds.streams.scores
        : next.txodds.streams.odds)

  const anySource = next.sources.length > 0
  const allOk =
    anySource &&
    (!next.sources.includes('telegram') || telegramOk) &&
    (!next.sources.includes('txodds') || txoddsOk)

  next.status = allOk ? 'ok' : anySource ? 'degraded' : 'down'
  snapshot = next
}

export function getHealthSnapshot(): HealthSnapshot {
  return { ...snapshot, stats: getStats() }
}

export function startHealthServer(
  config: IngestionConfig,
  writers: Map<string, UnifiedStreamWriter>,
): void {
  const firstWriter = writers.values().next().value
  const sourceKeys = Object.fromEntries(
    [...writers.entries()].map(([tag, w]) => [tag, w.sourceStreamKey]),
  )

  updateHealth({
    sources: config.sources,
    stream: firstWriter?.unifiedStreamKey ?? '',
    streams: {
      unified: firstWriter?.unifiedStreamKey ?? '',
      sources: sourceKeys,
    },
    config: config.telegram
      ? {
          channelsConfigPath: config.telegram.channelsConfigPath,
          channelShard: config.telegram.channels,
        }
      : {},
    telegram: config.telegram
      ? {
          connected: false,
          authorized: false,
          channelsJoined: 0,
          sessionIndex: config.telegram.sessionIndex,
          sessionCount: config.telegram.sessionCount,
        }
      : null,
    txodds: config.txodds
      ? {
          connected: false,
          streamMode: config.txodds.streamMode,
          fixturesCached: 0,
          streams: { scores: false, odds: false },
          apiOrigin: config.txodds.apiOrigin,
        }
      : null,
  })

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.url !== '/health' && req.url !== '/healthz' && req.url !== '/') {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
      return
    }

    const body: HealthSnapshot = {
      ...snapshot,
      stats: getStats(),
    }
    res.writeHead(200, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    })
    res.end(JSON.stringify(body))
  })

  const port = Number(process.env.PORT ?? config.healthPort)
  server.listen(port, () => {
    console.info('[signal-ingestion] health listening', { port })
  })
}
