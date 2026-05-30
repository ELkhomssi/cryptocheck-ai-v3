import 'server-only'

import { getPortfolio, readPortfolioSnapshot } from '@/lib/portfolio/portfolio-tracker'

export type RiskAlertType = 'RISK_INCREASE' | 'NOW_BLOCKED' | 'EXPOSURE_CHANGE'

export interface RiskAlert {
  type: RiskAlertType
  severity: 'info' | 'warning' | 'urgent'
  message: string
  mint?: string
  symbol?: string
  riskScore?: number
  riskDelta?: number
  at: string
}

const RISK_DELTA_THRESHOLD = 20
const BLOCKED_SCORE = 80

/**
 * Computes risk alerts by diffing the current portfolio against the last stored snapshot.
 * Reads the previous snapshot BEFORE recomputing (getPortfolio overwrites it).
 * Pull model — call from a cron or SSE poll. Returns alerts; delivery is the caller's concern.
 */
export async function monitorPortfolioRisk(walletAddress: string, chain = 'solana'): Promise<RiskAlert[]> {
  const prev = await readPortfolioSnapshot(walletAddress, chain)
  const portfolio = await getPortfolio(walletAddress, chain)
  const now = new Date().toISOString()
  const alerts: RiskAlert[] = []

  const prevByMint = new Map((prev?.positions ?? []).map((p) => [p.mint, p.riskScore]))

  for (const pos of portfolio.positions) {
    const prevScore = prevByMint.get(pos.mint)

    if (pos.riskScore >= BLOCKED_SCORE && (prevScore == null || prevScore < BLOCKED_SCORE)) {
      alerts.push({
        type: 'NOW_BLOCKED',
        severity: 'urgent',
        message: `${pos.symbol} is now BLOCKED (risk ${pos.riskScore}/100). Consider exiting.`,
        mint: pos.mint,
        symbol: pos.symbol,
        riskScore: pos.riskScore,
        at: now,
      })
      continue
    }

    if (prevScore != null) {
      const delta = pos.riskScore - prevScore
      if (delta > RISK_DELTA_THRESHOLD) {
        alerts.push({
          type: 'RISK_INCREASE',
          severity: 'warning',
          message: `${pos.symbol} risk increased ${delta} points since last check (now ${pos.riskScore}/100).`,
          mint: pos.mint,
          symbol: pos.symbol,
          riskScore: pos.riskScore,
          riskDelta: delta,
          at: now,
        })
      }
    }
  }

  if (prev && prev.exposure !== portfolio.riskExposure) {
    alerts.push({
      type: 'EXPOSURE_CHANGE',
      severity: portfolio.riskExposure === 'CRITICAL' ? 'urgent' : 'info',
      message: `Portfolio risk exposure changed: ${prev.exposure} → ${portfolio.riskExposure}.`,
      at: now,
    })
  }

  return alerts
}
