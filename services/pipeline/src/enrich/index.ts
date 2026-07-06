import 'dotenv/config'
import { createServer } from 'node:http'
import { createRedis } from '../lib/redis-client.js'
import {
  ackParsedEntries,
  ensureEnrichConsumerGroup,
  readParsedBatch,
} from '../lib/redis-stream-parsed.js'
import { processParsedEntry } from './processor.js'
import { getEnrichStats, markError } from './stats.js'

const CONSUMER = process.env.SIGNAL_ENRICH_CONSUMER ?? `enrich-${process.pid}`
const BATCH = Number(process.env.SIGNAL_ENRICH_BATCH ?? 10)
const BLOCK_MS = Number(process.env.SIGNAL_ENRICH_BLOCK_MS ?? 3000)
const HEALTH_PORT = Number(process.env.SIGNAL_ENRICH_HEALTH_PORT ?? 4104)

function startHealthServer(): void {
  createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'signal-pipeline:enrich',
        consumer: CONSUMER,
        stats: getEnrichStats(),
      }),
    )
  }).listen(HEALTH_PORT, () => {
    console.info('[signal-pipeline:enrich] health listening', { port: HEALTH_PORT })
  })
}

async function handleBatch(redis: ReturnType<typeof createRedis>): Promise<number> {
  const entries = await readParsedBatch(CONSUMER, BATCH, BLOCK_MS)
  if (!entries.length) return 0

  const ackIds: string[] = []

  for (const row of entries) {
    try {
      await processParsedEntry(redis, row.entry)
      ackIds.push(row.id)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:enrich] process failed', {
        streamId: row.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  await ackParsedEntries(ackIds)
  return entries.length
}

async function main(): Promise<void> {
  const redis = createRedis()
  await ensureEnrichConsumerGroup()
  startHealthServer()

  console.info('[signal-pipeline:enrich] running', { consumer: CONSUMER })

  for (;;) {
    try {
      await handleBatch(redis)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:enrich] loop error', e instanceof Error ? e.message : e)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

main().catch((e) => {
  console.error('[signal-pipeline:enrich] fatal', e)
  process.exit(1)
})
