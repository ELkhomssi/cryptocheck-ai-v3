import 'dotenv/config'
import { createServer } from 'node:http'
import { AgentEngine, loadAgentConfig } from '../agent/index.js'
import { createRedis } from '../lib/redis-client.js'
import {
  ackUnifiedEntries,
  ensureGateConsumerGroup,
  readUnifiedBatch,
} from '../lib/redis-stream-unified.js'
import { processUnifiedSignal } from './processor.js'
import { getGateStats, markError } from './stats.js'

const CONSUMER = process.env.SIGNAL_GATE_CONSUMER ?? `gate-${process.pid}`
const BATCH = Number(process.env.SIGNAL_GATE_BATCH ?? 10)
const BLOCK_MS = Number(process.env.SIGNAL_GATE_BLOCK_MS ?? 3000)
const HEALTH_PORT = Number(process.env.SIGNAL_GATE_HEALTH_PORT ?? 4105)

function startHealthServer(agent: AgentEngine): void {
  createServer((_req, res) => {
    const cfg = agent.getConfig()
    const snap = agent.getStore().snapshot()
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'signal-pipeline:gate',
        consumer: CONSUMER,
        stream: 'ccai:sig:stream:unified',
        consumerGroup: 'ccai:sig:cg:gate',
        stats: getGateStats(),
        agent: {
          agentId: cfg.agentId,
          enabled: cfg.enabled,
          killSwitch: cfg.killSwitch,
          mode: cfg.mode,
          edgeThreshold: cfg.edgeThreshold,
          confidenceFloor: cfg.confidenceFloor,
          openDecisions: snap.open.length,
          day: snap.day,
        },
      }),
    )
  }).listen(HEALTH_PORT, () => {
    console.info('[signal-pipeline:gate] health listening', { port: HEALTH_PORT })
  })
}

async function handleBatch(
  redis: ReturnType<typeof createRedis>,
  agent: AgentEngine,
): Promise<number> {
  const entries = await readUnifiedBatch(CONSUMER, BATCH, BLOCK_MS)
  if (!entries.length) return 0

  const ackIds: string[] = []

  for (const row of entries) {
    try {
      await processUnifiedSignal(redis, row.signal, agent)
      ackIds.push(row.id)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:gate] process failed', {
        streamId: row.id,
        signalId: row.signal.id,
        subjectType: row.signal.subjectType,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  await ackUnifiedEntries(ackIds)
  return entries.length
}

async function main(): Promise<void> {
  const redis = createRedis()
  const agentConfig = loadAgentConfig()
  const agent = new AgentEngine(agentConfig, redis)

  await ensureGateConsumerGroup()
  startHealthServer(agent)

  console.info('[signal-pipeline:gate] running', {
    consumer: CONSUMER,
    stream: 'ccai:sig:stream:unified',
    group: 'ccai:sig:cg:gate',
    agent: {
      id: agentConfig.agentId,
      enabled: agentConfig.enabled,
      killSwitch: agentConfig.killSwitch,
      mode: agentConfig.mode,
    },
  })

  for (;;) {
    try {
      await handleBatch(redis, agent)
    } catch (e) {
      markError()
      console.error('[signal-pipeline:gate] loop error', e instanceof Error ? e.message : e)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

main().catch((e) => {
  console.error('[signal-pipeline:gate] fatal', e)
  process.exit(1)
})
