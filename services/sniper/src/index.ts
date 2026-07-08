import 'dotenv/config'
import { createServer, type ServerResponse } from 'node:http'
import { loadConfig } from './config.js'
import { supabaseConfigured } from './persist.js'
import { createServiceHeartbeat } from './service-heartbeat.js'
import { newStats, processSignal, type SniperStats } from './sniper.js'
import { ackEntries, ensureSniperConsumerGroup, readUnifiedBatch } from './stream.js'

const cfg = loadConfig()
const stats = newStats()
const CONSUMER = process.env.SNIPER_CONSUMER ?? `sniper-${process.pid}`

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function healthBody(s: SniperStats) {
  return {
    status: cfg.enabled ? (s.errors > 0 ? 'degraded' : 'ok') : 'idle',
    service: 'sniper',
    enabled: cfg.enabled,
    scannerUrl: cfg.scannerUrl,
    minScore: cfg.minScore,
    triggerTypes: cfg.triggerTypes,
    auditLog: supabaseConfigured(),
    consumer: CONSUMER,
    stream: 'ccai:sig:stream:unified',
    consumerGroup: 'ccai:sig:cg:sniper',
    stats: s,
  }
}

function startHealthServer(): void {
  createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/healthz' || path === '/health' || path === '/') {
      json(res, 200, healthBody(stats))
      return
    }
    json(res, 404, { error: 'not found' })
  }).listen(cfg.port, () => {
    console.info('[signal-sniper] health listening', { port: cfg.port })
  })
}

async function loop(): Promise<void> {
  for (;;) {
    try {
      const entries = await readUnifiedBatch(CONSUMER, cfg.batch, cfg.blockMs)
      if (!entries.length) continue
      const ackIds: string[] = []
      for (const row of entries) {
        try {
          await processSignal(row.signal, cfg, stats)
        } catch (e) {
          stats.errors += 1
          console.error('[signal-sniper] process failed', {
            streamId: row.id,
            signalId: row.signal.id,
            error: e instanceof Error ? e.message : String(e),
          })
        }
        // Ack regardless — a failed scan already fails safe (no buy),
        // and re-processing dead entries would stall the group.
        ackIds.push(row.id)
      }
      await ackEntries(ackIds)
    } catch (e) {
      stats.errors += 1
      console.error('[signal-sniper] loop error', e instanceof Error ? e.message : e)
      await new Promise((r) => setTimeout(r, 2_000))
    }
  }
}

async function main(): Promise<void> {
  startHealthServer()

  const heartbeat = createServiceHeartbeat('sniper')
  heartbeat.start(() => ({
    status: cfg.enabled ? (stats.errors > 0 ? 'degraded' : 'ok') : 'down',
  }))

  if (!cfg.enabled) {
    console.warn('[signal-sniper] SNIPER_ENABLED=false — detector idle (health only)')
    return
  }

  await ensureSniperConsumerGroup()
  console.info('[signal-sniper] running', {
    consumer: CONSUMER,
    scannerUrl: cfg.scannerUrl,
    minScore: cfg.minScore,
    triggerTypes: cfg.triggerTypes,
    auditLog: supabaseConfigured(),
  })

  await loop()
}

main().catch((e) => {
  console.error('[signal-sniper] fatal', e instanceof Error ? e.message : e)
  process.exit(1)
})
