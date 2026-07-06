/**
 * Seed the Sentinel Edge dashboard for rehearsal / demo when live TxODDS is quiet.
 *
 * - Replays sample matches through evaluator + AgentEngine (paper)
 * - Writes decisions/settlements to `ccai:sig:stream:agent`
 * - Indexes proofs under `ccai:sig:proof:*` (Verify works)
 * - Stores track record at `ccai:sig:agent:backtest:latest`
 *
 * Run: npm run demo-seed
 * Requires: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
import 'dotenv/config'
import {
  SIGNAL_AGENT_BACKTEST_KEY,
  SIGNAL_AGENT_CONTROL_KEY,
  type AgentControlState,
} from '@cryptocheck/signal-contracts'
import { Redis } from '@upstash/redis'
import { runBacktest } from './harness.js'
import { SAMPLE_MATCHES } from './sample-matches.js'

async function main(): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for demo-seed')
  }

  process.env.SIGNAL_AGENT_SIGNING_KEY =
    process.env.SIGNAL_AGENT_SIGNING_KEY?.trim() ||
    process.env.SIGNAL_WORKER_SECRET?.trim() ||
    'demo-seed-signing-key'

  const redis = new Redis({ url, token })

  const control: AgentControlState = {
    enabled: true,
    killSwitch: false,
    mode: 'paper',
    edgeThreshold: Number(process.env.SIGNAL_AGENT_EDGE_THRESHOLD ?? 35),
    confidenceFloor: Number(process.env.SIGNAL_AGENT_CONFIDENCE_FLOOR ?? 0.45),
    maxPositionSize: Number(process.env.SIGNAL_AGENT_MAX_SIZE ?? 10),
    perMatchCap: Number(process.env.SIGNAL_AGENT_PER_MATCH_CAP ?? 30),
    dailyLossLimit: Number(process.env.SIGNAL_AGENT_DAILY_LOSS_LIMIT ?? 100),
    updatedAt: new Date().toISOString(),
  }
  await redis.set(SIGNAL_AGENT_CONTROL_KEY, JSON.stringify(control))

  console.log('[demo-seed] replaying sample matches into agent tape + proof index…')
  const track = await runBacktest(
    SAMPLE_MATCHES,
    {
      agentId: 'sentinel-edge-demo',
      agentPubkey: 'demo-pubkey',
      edgeThreshold: control.edgeThreshold,
      confidenceFloor: control.confidenceFloor,
    },
    redis,
  )

  const summary = {
    matches: track.matches,
    decisions: track.decisions.length,
    settlements: track.settlements.length,
    totalPnl: track.totalPnl,
    wins: track.wins,
    losses: track.losses,
    pushes: track.pushes,
    voids: track.voids,
    hitRate: Number(track.hitRate.toFixed(3)),
    allVerified: track.allVerified,
    ranAt: new Date().toISOString(),
    label: 'verifiable on-chain' as const,
    source: 'demo-seed',
  }
  await redis.set(SIGNAL_AGENT_BACKTEST_KEY, JSON.stringify(summary))

  console.log('\n=== Demo seed complete ===\n')
  console.log(JSON.stringify(summary, null, 2))
  console.log('\nOpen /dashboard/signals/agent — tape, track record, and Verify should work.')
  console.log(
    'Use the same SIGNAL_AGENT_SIGNING_KEY on the Next.js app for HMAC verify:',
    process.env.SIGNAL_AGENT_SIGNING_KEY.slice(0, 8) + '…',
  )

  if (!track.allVerified || track.decisions.length === 0) {
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[demo-seed] failed', e)
  process.exit(1)
})
