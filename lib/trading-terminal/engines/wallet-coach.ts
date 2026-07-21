/**
 * PROMPT 21 — Wallet-aware proactive AI Coach
 *
 * Defense (drawdown/risk) + offense (opportunity nudges).
 * Evidence always attached. Never promises. Thin evidence → stay silent.
 */

import type { Opportunity } from './opportunity-engine'
import type { LivePortfolioBrain } from '../live-portfolio-brain'
import type { DemoPosition } from '../data/types'

export type CoachNudgeKind = 'defense' | 'offense'

export type CoachNudge = {
  id: string
  symbol: string
  mint: string
  kind: CoachNudgeKind
  message: string
  evidence: string[]
  confidencePct: number
  suggestedAction: 'EXIT' | 'REDUCE' | 'BUY' | 'MONITOR' | 'WATCH'
}

/**
 * Defense loop: holdings with deteriorating risk / threats.
 * Offense loop: high-conviction opportunities.
 * Returns [] when evidence is thin (stay silent).
 */
export function buildWalletCoachNudges(input: {
  positions: Array<Pick<DemoPosition, 'mint' | 'symbol' | 'pnlPct' | 'riskScore' | 'verdict' | 'valueUsd'>>
  brain: LivePortfolioBrain | null
  opportunities: Opportunity[]
}): CoachNudge[] {
  const nudges: CoachNudge[] = []

  for (const t of input.brain?.threats ?? []) {
    if (t.severity !== 'HIGH' && t.severity !== 'MED') continue
    nudges.push({
      id: `def-${t.mint}`,
      symbol: t.symbol,
      mint: t.mint,
      kind: 'defense',
      message: `Heads up — ${t.symbol} shows deteriorating signals. ${t.reason}. Consider trimming.`,
      evidence: [t.reason, `Severity ${t.severity}`],
      confidencePct: t.severity === 'HIGH' ? 82 : 68,
      suggestedAction: t.severity === 'HIGH' ? 'EXIT' : 'REDUCE',
    })
  }

  for (const p of input.positions) {
    if (p.verdict === 'DANGER' && p.pnlPct <= -8) {
      if (nudges.some((n) => n.mint === p.mint)) continue
      nudges.push({
        id: `def-pnl-${p.mint}`,
        symbol: p.symbol,
        mint: p.mint,
        kind: 'defense',
        message: `${p.symbol} is down ${Math.abs(p.pnlPct).toFixed(0)}% with DANGER risk ${p.riskScore}. Review exit.`,
        evidence: [`PnL ${p.pnlPct.toFixed(1)}%`, `Risk ${p.riskScore}`, `Verdict ${p.verdict}`],
        confidencePct: 75,
        suggestedAction: 'EXIT',
      })
    }
  }

  for (const o of input.opportunities) {
    if (o.convictionScore < 70 || o.confidencePct < 60) continue // stay silent if thin
    nudges.push({
      id: `off-${o.mint}`,
      symbol: o.symbol,
      mint: o.mint,
      kind: 'offense',
      message: `Setup forming on ${o.symbol} — ${o.whyNow}. Conviction ${o.convictionScore}/100.`,
      evidence: o.reasons.map((r) => r.text),
      confidencePct: o.confidencePct,
      suggestedAction: o.convictionScore >= 80 ? 'BUY' : 'WATCH',
    })
  }

  // Cap — never spam
  return nudges
    .sort((a, b) => {
      const ka = a.kind === 'defense' ? 100 : 0
      const kb = b.kind === 'defense' ? 100 : 0
      return kb + b.confidencePct - (ka + a.confidencePct)
    })
    .slice(0, 4)
}
