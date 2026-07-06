/**
 * Run: npx tsx src/agent/backtest/run-backtest.ts
 */
import 'dotenv/config'
import { SIGNAL_AGENT_BACKTEST_KEY } from '@cryptocheck/signal-contracts'
import { Redis } from '@upstash/redis'
import { runBacktest } from './harness.js'
import { SAMPLE_MATCHES } from './sample-matches.js'

async function main(): Promise<void> {
  process.env.SIGNAL_AGENT_SIGNING_KEY = process.env.SIGNAL_AGENT_SIGNING_KEY || 'backtest-signing-key'

  const track = await runBacktest(SAMPLE_MATCHES)

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
    verifications: track.verifications.map((v) => ({
      ok: v.ok,
      commitmentHash: v.commitmentHash.slice(0, 16),
      checks: v.checks,
    })),
    decisionProofs: track.decisions.map((d) => ({
      id: d.id,
      matchId: d.matchId,
      side: d.side,
      size: d.size,
      magnitude: d.edgeSignal.magnitude,
      rationale: d.edgeSignal.rationale.slice(0, 80),
      dataHash: d.dataHash.slice(0, 16),
      commitmentHash: d.proof?.commitmentHash.slice(0, 16),
      tx: d.proof?.txSignature,
    })),
    settlementPnl: track.settlements.map((s) => ({
      decisionId: s.decisionId,
      outcome: s.outcome,
      realizedPnl: s.realizedPnl,
      commitmentHash: s.proof?.commitmentHash.slice(0, 16),
    })),
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  if (url && token) {
    const redis = new Redis({ url, token })
    await redis.set(SIGNAL_AGENT_BACKTEST_KEY, JSON.stringify(summary))
    console.log('Wrote backtest to', SIGNAL_AGENT_BACKTEST_KEY)
  }

  console.log('\n=== Sentinel Edge — verifiable backtest track record ===\n')
  console.log(JSON.stringify(summary, null, 2))

  if (!track.allVerified) {
    console.error('\nBacktest failed: not all proofs verified')
    process.exit(1)
  }
  if (track.decisions.length === 0) {
    console.error('\nBacktest failed: no decisions committed')
    process.exit(1)
  }

  console.log('\nAll committed decisions verified. P&L derived from settlements only.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
