import type { Decision, Settlement } from '@cryptocheck/signal-contracts'
import { decisionsFromTape, readAgentTape, settlementsFromTape } from './tape'
import { getAgentRedis } from './redis'
import { SIGNAL_AGENT_BACKTEST_KEY } from '@cryptocheck/signal-contracts'

export type LiveTrackRecord = {
  decisionsCount: number
  settlementsCount: number
  openCount: number
  totalPnl: number
  wins: number
  losses: number
  pushes: number
  voids: number
  hitRate: number
  label: 'verifiable on-chain'
  decisions: Decision[]
  settlements: Settlement[]
}

export async function buildLiveTrackRecord(): Promise<LiveTrackRecord> {
  const tape = await readAgentTape(200)
  const decisions = decisionsFromTape(tape)
  const settlements = settlementsFromTape(tape)

  const settledIds = new Set(settlements.map((s) => s.decisionId))
  const openCount = decisions.filter((d) => !settledIds.has(d.id)).length

  const wins = settlements.filter((s) => s.outcome === 'win').length
  const losses = settlements.filter((s) => s.outcome === 'lose').length
  const pushes = settlements.filter((s) => s.outcome === 'push').length
  const voids = settlements.filter((s) => s.outcome === 'void').length
  const decided = wins + losses
  const totalPnl = settlements.reduce((a, s) => a + s.realizedPnl, 0)

  return {
    decisionsCount: decisions.length,
    settlementsCount: settlements.length,
    openCount,
    totalPnl: Math.round(totalPnl * 100) / 100,
    wins,
    losses,
    pushes,
    voids,
    hitRate: decided > 0 ? wins / decided : 0,
    label: 'verifiable on-chain',
    decisions,
    settlements,
  }
}

export async function readBacktestRecord(): Promise<unknown | null> {
  const redis = getAgentRedis()
  if (!redis) return null
  const raw = await redis.get<string | object>(SIGNAL_AGENT_BACKTEST_KEY)
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw
}
