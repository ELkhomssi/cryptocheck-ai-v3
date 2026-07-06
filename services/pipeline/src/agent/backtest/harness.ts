/**
 * Backtest harness — replay synthetic / historical match timelines through
 * SportsSignalEvaluator + AgentEngine (paper). Track record is derived only
 * from committed decisions vs outcomes — no fabricated P&L.
 */
import type {
  AgentConfig,
  Decision,
  Settlement,
  UnifiedSignal,
  VerifyResult,
} from '@cryptocheck/signal-contracts'
import type { Redis } from '@upstash/redis'
import { evaluateSportsSignal, resetMatchWindows } from '../../gate/sports-evaluator.js'
import { AgentEngine } from '../engine.js'

export type BacktestTick = {
  /** Offset ms from match start. */
  atMs: number
  signal: Omit<UnifiedSignal, 'edgeSignal' | 'scoreValue' | 'verdict' | 'confidence'> & {
    confidence?: number
    verdict?: UnifiedSignal['verdict']
  }
}

export type BacktestMatch = {
  matchId: string
  label: string
  ticks: BacktestTick[]
}

export type BacktestTrackRecord = {
  matches: number
  decisions: Decision[]
  settlements: Settlement[]
  totalPnl: number
  wins: number
  losses: number
  pushes: number
  voids: number
  hitRate: number
  verifications: VerifyResult[]
  allVerified: boolean
}

function enrich(signal: UnifiedSignal): UnifiedSignal {
  const evalResult = evaluateSportsSignal(signal)
  return {
    ...signal,
    verdict: evalResult.verdict,
    scoreValue: evalResult.scoreValue,
    confidence: evalResult.confidence,
    edgeSignal: evalResult.edgeSignal,
    rawPayload: {
      ...signal.rawPayload,
      edgeSignal: evalResult.edgeSignal,
    },
  }
}

export async function runBacktest(
  matches: BacktestMatch[],
  config?: Partial<AgentConfig>,
  redis?: Redis | null,
): Promise<BacktestTrackRecord> {
  resetMatchWindows()

  const agentConfig: AgentConfig = {
    agentId: config?.agentId ?? 'backtest-agent',
    enabled: true,
    killSwitch: false,
    mode: 'paper',
    enabledDetectors: config?.enabledDetectors ?? [
      'latency_edge',
      'line_velocity',
      'model_divergence',
    ],
    edgeThreshold: config?.edgeThreshold ?? 35,
    confidenceFloor: config?.confidenceFloor ?? 0.45,
    maxPositionSize: config?.maxPositionSize ?? 10,
    perMatchCap: config?.perMatchCap ?? 30,
    dailyLossLimit: config?.dailyLossLimit ?? 100,
    agentPubkey: config?.agentPubkey ?? 'backtest-pubkey',
  }

  // Pass Redis to publish tape events + proof index (demo-seed / dashboard).
  const engine = new AgentEngine(agentConfig, redis ?? null)
  const decisions: Decision[] = []
  const settlements: Settlement[] = []
  const verifications: VerifyResult[] = []

  const baseTs = Date.parse('2026-06-14T17:00:00.000Z')

  for (const match of matches) {
    resetMatchWindows()
    const sorted = [...match.ticks].sort((a, b) => a.atMs - b.atMs)

    for (const tick of sorted) {
      const msgTimestamp = new Date(baseTs + tick.atMs).toISOString()
      const partial = tick.signal
      const signal: UnifiedSignal = enrich({
        ...partial,
        matchId: partial.matchId ?? match.matchId,
        label: partial.label ?? match.label,
        msgTimestamp,
        ingestTimestamp: msgTimestamp,
        confidence: partial.confidence ?? 1,
        verdict: partial.verdict ?? 'scanning',
        subjectType: 'match_event',
        sourceTag: 'txodds',
        sources: ['txodds'],
        sourceCount: 1,
      })

      const result = await engine.onSignal(signal)
      if (result.kind === 'decision') {
        decisions.push(result.decision)
        if (result.decision.proof?.commitmentHash) {
          verifications.push(await engine.getProof().verify(result.decision.proof.commitmentHash))
        }
      }
      if (result.kind === 'settlement') {
        settlements.push(...result.settlements)
        for (const s of result.settlements) {
          if (s.proof?.commitmentHash) {
            verifications.push(await engine.getProof().verify(s.proof.commitmentHash))
          }
        }
      }
    }
  }

  const wins = settlements.filter((s) => s.outcome === 'win').length
  const losses = settlements.filter((s) => s.outcome === 'lose').length
  const pushes = settlements.filter((s) => s.outcome === 'push').length
  const voids = settlements.filter((s) => s.outcome === 'void').length
  const decided = wins + losses
  const totalPnl = settlements.reduce((a, s) => a + s.realizedPnl, 0)

  return {
    matches: matches.length,
    decisions,
    settlements,
    totalPnl: Math.round(totalPnl * 100) / 100,
    wins,
    losses,
    pushes,
    voids,
    hitRate: decided > 0 ? wins / decided : 0,
    verifications,
    allVerified: verifications.length > 0 && verifications.every((v) => v.ok),
  }
}
