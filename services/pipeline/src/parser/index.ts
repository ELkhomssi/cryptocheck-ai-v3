import 'dotenv/config'
import { createServer } from 'node:http'
import { createRedis } from '../lib/redis-client.js'
import {
  ackRawEntries,
  ensureParserConsumerGroup,
  readRawBatch,
} from '../lib/redis-stream-consumer.js'
import { writeParsedEntry } from '../lib/redis-stream-producer.js'
import { processRawMessage } from './parse-raw.js'
import { getParserStats, markEmitted, markError, markProcessed, markRemoved, markSkipped } from './stats.js'

const CONSUMER = process.env.SIGNAL_PARSER_CONSUMER ?? `parser-${process.pid}`
const BATCH = Number(process.env.SIGNAL_PARSER_BATCH ?? 20)
const BLOCK_MS = Number(process.env.SIGNAL_PARSER_BLOCK_MS ?? 3000)
const HEALTH_PORT = Number(process.env.SIGNAL_PARSER_HEALTH_PORT ?? 4103)

function startHealthServer(): void {
  createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'signal-pipeline:parser',
        consumer: CONSUMER,
        stats: getParserStats(),
      }),
    )
  }).listen(HEALTH_PORT, () => {
    console.info('[signal-pipeline:parser] health listening', { port: HEALTH_PORT })
  })
}

async function handleBatch(redis: ReturnType<typeof createRedis>): Promise<number> {
  const entries = await readRawBatch(CONSUMER, BATCH, BLOCK_MS)
  if (!entries.length) return 0

  const ackIds: string[] = []

  for (const entry of entries) {
    markProcessed()
    try {
      const outputs = await processRawMessage(redis, entry.message)
      if (!outputs.length) {
        markSkipped()
        ackIds.push(entry.id)
        continue
      }

      for (const out of outputs) {
        await writeParsedEntry(redis, out)
        if (out.kind === 'remove') markRemoved()
        else markEmitted()
      }
      ackIds.push(entry.id)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:parser] process failed', {
        id: entry.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  await ackRawEntries(ackIds)
  return entries.length
}

async function main(): Promise<void> {
  const redis = createRedis()
  await ensureParserConsumerGroup()
  startHealthServer()

  console.info('[signal-pipeline:parser] running', { consumer: CONSUMER })

  for (;;) {
    try {
      await handleBatch(redis)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:parser] loop error', e instanceof Error ? e.message : e)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

main().catch((e) => {
  console.error('[signal-pipeline:parser] fatal', e)
  process.exit(1)
})
