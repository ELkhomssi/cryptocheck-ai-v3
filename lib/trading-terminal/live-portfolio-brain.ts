/**
 * Derive Portfolio Health / Risk Exposure / Action Queue / Threats from real wallet holdings.
 * No fabricated desk research — only transforms portfolio API fields.
 */

import type { RevenuePortfolioSummary } from '@/lib/revenue-dashboard/portfolio-mapper'
import type { RevenueVerdict } from '@/lib/revenue-dashboard/types'

export type LiveBrainAction = {
  type: 'EXIT' | 'REDUCE' | 'MONITOR' | 'ADD' | 'WATCHLIST'
  symbol: string
  mint: string
  reason: string
  priority: number
}

export type LivePortfolioBrain = {
  health: { score: number; issues: string[] }
  riskExposure: {
    categories: Array<{ name: string; pct: number }>
    flags: string[]
    band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }
  threats: Array<{ symbol: string; mint: string; reason: string; severity: 'LOW' | 'MED' | 'HIGH' }>
  actionQueue: LiveBrainAction[]
  capitalAllocation: string
  portions: {
    totalUsd: number
    pnlUsd: number | null
    pnlPct: number | null
    legend: Array<{ name: string; pct: number; valueUsd: number }>
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** Build brain from revenue portfolio summary (gateway-scanned holdings). */
export function buildLivePortfolioBrain(summary: RevenuePortfolioSummary): LivePortfolioBrain {
  const total = summary.totalValueUsd
  const positions = summary.positions
  const issues: string[] = []
  let score = 100

  const danger = positions.filter((p) => p.verdict === 'DANGER')
  const caution = positions.filter((p) => p.verdict === 'CAUTION')
  const safe = positions.filter((p) => p.verdict === 'SAFE')

  score -= Math.min(40, danger.length * 12)
  score -= Math.min(24, caution.length * 6)

  if (summary.flaggedPct >= 35) {
    score -= 12
    issues.push(`Flagged book ${summary.flaggedPct.toFixed(0)}% of value`)
  }
  if (summary.flaggedCount > 0) {
    issues.push(`${summary.flaggedCount} holding${summary.flaggedCount === 1 ? '' : 's'} flagged CAUTION/DANGER`)
  }

  const top = positions[0]
  if (top && top.concentrationPct >= 40) {
    score -= 10
    issues.push(`${top.symbol} concentration ${top.concentrationPct.toFixed(0)}%`)
  }

  const band = summary.exposure
  if (band === 'CRITICAL') score = Math.min(score, 28)
  else if (band === 'HIGH') score = Math.min(score, 48)
  else if (band === 'MEDIUM') score = Math.min(score, 72)

  if (issues.length === 0) {
    issues.push(positions.length === 0 ? 'No holdings above dust threshold' : 'No structural flags on scanned book')
  }

  const catValue = (v: RevenueVerdict) =>
    positions.filter((p) => p.verdict === v).reduce((a, p) => a + p.valueUsd, 0)
  const safeUsd = catValue('SAFE')
  const cautionUsd = catValue('CAUTION')
  const dangerUsd = catValue('DANGER')
  const denom = total > 0 ? total : 1

  const categories = [
    { name: 'SAFE', pct: Math.round((safeUsd / denom) * 100) },
    { name: 'CAUTION', pct: Math.round((cautionUsd / denom) * 100) },
    { name: 'DANGER', pct: Math.round((dangerUsd / denom) * 100) },
  ].filter((c) => c.pct > 0 || positions.length === 0)

  const flags: string[] = []
  if (band === 'CRITICAL' || band === 'HIGH') flags.push(`Exposure band ${band}`)
  if (summary.flaggedPct >= 20) flags.push('Elevated flagged allocation')

  const threats = danger.slice(0, 6).map((p) => ({
    symbol: p.symbol,
    mint: p.mint,
    reason: `Risk ${p.riskScore} · ${p.concentrationPct.toFixed(0)}% of book`,
    severity: (p.riskScore >= 80 ? 'HIGH' : 'MED') as 'LOW' | 'MED' | 'HIGH',
  }))

  const actionQueue: LiveBrainAction[] = []
  for (const p of danger.slice(0, 4)) {
    actionQueue.push({
      type: 'EXIT',
      symbol: p.symbol,
      mint: p.mint,
      reason: `DANGER · risk ${p.riskScore}. Review exit via ticket.`,
      priority: 100 - p.riskScore,
    })
  }
  for (const p of caution.slice(0, 3)) {
    if (p.concentrationPct >= 25) {
      actionQueue.push({
        type: 'REDUCE',
        symbol: p.symbol,
        mint: p.mint,
        reason: `CAUTION · concentration ${p.concentrationPct.toFixed(0)}%.`,
        priority: 50,
      })
    } else {
      actionQueue.push({
        type: 'MONITOR',
        symbol: p.symbol,
        mint: p.mint,
        reason: `CAUTION · risk ${p.riskScore}. Rescan before adding.`,
        priority: 30,
      })
    }
  }
  actionQueue.sort((a, b) => b.priority - a.priority)

  let capitalAllocation: string
  if (positions.length === 0) {
    capitalAllocation = 'No scanned holdings. Deploy only after a focus scan clears the ticket.'
  } else if (danger.length > 0) {
    capitalAllocation = `Prioritize reducing DANGER sleeves (${danger.length}) before new risk. Keep dry powder until exposure cools.`
  } else if (caution.length > safe.length) {
    capitalAllocation = 'Book skews CAUTION — size new entries smaller and prefer SAFE names on Discover.'
  } else {
    capitalAllocation = 'Book risk is contained. Scale only into scanned SAFE/CAUTION with explicit ticket size.'
  }

  const legend = positions.slice(0, 6).map((p) => ({
    name: p.symbol,
    pct: total > 0 ? (p.valueUsd / total) * 100 : 0,
    valueUsd: p.valueUsd,
  }))

  return {
    health: { score: clamp(Math.round(score), 0, 100), issues },
    riskExposure: { categories, flags, band },
    threats,
    actionQueue: actionQueue.slice(0, 8),
    capitalAllocation,
    portions: {
      totalUsd: total,
      pnlUsd: summary.totalPnlUsd ?? null,
      pnlPct: summary.totalPnlPct ?? null,
      legend,
    },
  }
}
