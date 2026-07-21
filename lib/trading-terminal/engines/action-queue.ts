/**
 * PROMPT 17 — AI Action Queue
 *
 * Actions are emitted by engines (portfolio brain + opportunity), never hand-written.
 * priority = f(severity, confidence, time-sensitivity).
 */

import type { Opportunity } from './opportunity-engine'
import type { LiveBrainAction, LivePortfolioBrain } from '../live-portfolio-brain'

export type ActionType = 'BUY' | 'EXIT' | 'REDUCE' | 'MONITOR' | 'ADD' | 'WATCHLIST' | 'WATCH'

export type QueuedAction = {
  type: ActionType
  symbol: string
  mint: string
  priority: number
  reason: string
  expectedImpact: string
  confidence: number
  sourceEngine: 'portfolio-brain' | 'opportunity-engine' | 'threat-radar'
}

function severityBoost(type: ActionType): number {
  if (type === 'EXIT') return 40
  if (type === 'REDUCE') return 30
  if (type === 'BUY' || type === 'ADD') return 20
  if (type === 'MONITOR') return 10
  return 5
}

/** Merge brain + opportunity actions into a ranked queue. */
export function buildActionQueue(input: {
  brain: LivePortfolioBrain | null
  opportunities: Opportunity[]
  focusMint?: string
}): QueuedAction[] {
  const out: QueuedAction[] = []

  if (input.brain) {
    for (const t of input.brain.threats) {
      out.push({
        type: t.severity === 'HIGH' ? 'EXIT' : 'REDUCE',
        symbol: t.symbol,
        mint: t.mint,
        priority: 0,
        reason: t.reason,
        expectedImpact: 'Reduces book risk from deteriorating holding',
        confidence: t.severity === 'HIGH' ? 85 : 70,
        sourceEngine: 'threat-radar',
      })
    }
    for (const a of input.brain.actionQueue) {
      if (out.some((x) => x.mint === a.mint && x.type === a.type)) continue
      out.push({
        type: a.type,
        symbol: a.symbol,
        mint: a.mint,
        priority: 0,
        reason: a.reason,
        expectedImpact:
          a.type === 'EXIT' || a.type === 'REDUCE'
            ? 'Cuts flagged exposure'
            : 'Keeps risk under watch',
        confidence: 72,
        sourceEngine: 'portfolio-brain',
      })
    }
  }

  for (const o of input.opportunities.slice(0, 5)) {
    const type: ActionType =
      o.convictionScore >= 80 && o.stage === 'BREAKOUT'
        ? 'BUY'
        : o.convictionScore >= 65
          ? 'ADD'
          : 'WATCHLIST'
    out.push({
      type: type === 'ADD' && o.convictionScore >= 70 ? 'BUY' : type,
      symbol: o.symbol,
      mint: o.mint,
      priority: 0,
      reason: o.whyNow,
      expectedImpact: `Conviction ${o.convictionScore} · coverage ${o.confidencePct}%`,
      confidence: o.confidencePct,
      sourceEngine: 'opportunity-engine',
    })
  }

  for (const a of out) {
    a.priority =
      severityBoost(a.type) +
      Math.round(a.confidence * 0.35) +
      (input.focusMint && a.mint === input.focusMint ? 8 : 0)
  }

  out.sort((a, b) => b.priority - a.priority)

  // Dedupe by mint keeping highest priority
  const seen = new Set<string>()
  const deduped: QueuedAction[] = []
  for (const a of out) {
    const key = `${a.type}:${a.mint}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(a)
  }
  return deduped.slice(0, 8)
}

/** Map queued actions to the compact UI shape used by DEMO_SEED / coach column. */
export function toCoachActionRows(actions: QueuedAction[]): LiveBrainAction[] {
  return actions.map((a) => ({
    type: a.type,
    symbol: a.symbol,
    mint: a.mint,
    reason: a.reason,
    priority: a.priority,
  }))
}
