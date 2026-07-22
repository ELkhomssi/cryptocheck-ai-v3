/**
 * Resolve intelligence bundle for the terminal UI.
 * Demo: engines run on DEMO measured inputs + seed intel.
 * Live: portfolio brain + empty opportunities until live market inputs wired.
 */

import { getDemoSeed } from '../data/demo-seed'
import { buildLivePortfolioBrain, type LivePortfolioBrain } from '../live-portfolio-brain'
import type { RevenuePortfolioSummary } from '@/lib/revenue-dashboard/portfolio-mapper'
import { rankOpportunities, type Opportunity } from './opportunity-engine'
import { buildActionQueue, type QueuedAction } from './action-queue'
import { buildWalletCoachNudges, type CoachNudge } from './wallet-coach'
import { attributeOpportunity, type CausalAttribution } from './causal-attribution'
import { buildTerminalAlerts, type TerminalAlert } from './alerts-engine'
import { getDemoOpportunityInputs } from './demo-opportunity-inputs'
import type { TerminalDataMode } from '../data/types'

export type IntelligenceBundle = {
  mode: TerminalDataMode
  opportunities: Opportunity[]
  actions: QueuedAction[]
  nudges: CoachNudge[]
  brain: LivePortfolioBrain | null
  hero: Opportunity | null
  /** Causal shares for hero (or focus mint when ranked). */
  attribution: CausalAttribution | null
  alerts: TerminalAlert[]
  methodNote: string
}

function syntheticDemoSummary(): RevenuePortfolioSummary {
  const seed = getDemoSeed()
  const syntheticSummary: RevenuePortfolioSummary = {
    walletAddress: 'DEMO',
    totalValueUsd: seed.portions.totalUsd,
    holdingCount: seed.positions.length,
    flaggedCount: seed.positions.filter((p) => p.verdict !== 'SAFE').length,
    flaggedValueUsd: seed.positions
      .filter((p) => p.verdict !== 'SAFE')
      .reduce((a, p) => a + p.valueUsd, 0),
    flaggedPct: 0,
    exposure: 'MEDIUM',
    positions: seed.positions.map((p) => ({
      mint: p.mint,
      symbol: p.symbol,
      name: p.symbol,
      balance: p.size,
      valueUsd: p.valueUsd,
      safetyScore: 100 - p.riskScore,
      riskScore: p.riskScore,
      verdict: p.verdict,
      concentrationPct: seed.portions.totalUsd > 0 ? (p.valueUsd / seed.portions.totalUsd) * 100 : 0,
      scannedAt: new Date().toISOString(),
      estimated: false,
      avgEntryPriceUsd: p.entryUsd,
      currentPriceUsd: p.priceUsd,
      pnlUsd: p.pnlUsd,
      pnlPct: p.pnlPct,
    })),
    lastUpdatedAt: new Date().toISOString(),
    totalPnlUsd: seed.portions.pnl24hUsd,
    totalPnlPct: seed.portions.pnl24hPct,
  }
  syntheticSummary.flaggedPct =
    syntheticSummary.totalValueUsd > 0
      ? (syntheticSummary.flaggedValueUsd / syntheticSummary.totalValueUsd) * 100
      : 0
  return syntheticSummary
}

export function resolveIntelligence(input: {
  mode: TerminalDataMode
  portfolioSummary?: RevenuePortfolioSummary | null
  focusMint?: string
}): IntelligenceBundle {
  if (input.mode === 'demo') {
    const seed = getDemoSeed()
    const measured = getDemoOpportunityInputs()
    const opportunities = rankOpportunities(measured)
    const brainFromSeed: LivePortfolioBrain = {
      health: seed.coach.portfolioHealth,
      riskExposure: {
        categories: seed.coach.riskExposure.categories,
        flags: seed.coach.riskExposure.flags,
        band: 'MEDIUM',
      },
      threats: seed.coach.threats.map((t) => {
        const tok = seed.discover.find((d) => d.symbol === t.symbol)
        return {
          symbol: t.symbol,
          mint: tok?.mint ?? seed.focusMint,
          reason: t.reason,
          severity: t.severity,
        }
      }),
      actionQueue: [],
      capitalAllocation: seed.coach.capitalAllocation,
      portions: {
        totalUsd: seed.portions.totalUsd,
        pnlUsd: seed.portions.pnl24hUsd,
        pnlPct: seed.portions.pnl24hPct,
        legend: seed.portions.legend,
      },
    }

    const brain = buildLivePortfolioBrain(syntheticDemoSummary())
    brain.threats = brainFromSeed.threats.length ? brainFromSeed.threats : brain.threats

    const actions = buildActionQueue({
      brain,
      opportunities,
      focusMint: input.focusMint ?? seed.focusMint,
    })
    const nudges = buildWalletCoachNudges({
      positions: seed.positions,
      brain,
      opportunities,
    })
    const focus = input.focusMint ?? seed.focusMint
    const hero =
      opportunities.find((o) => o.mint === focus) ?? opportunities[0] ?? null
    const heroInput = measured.find((m) => m.mint === (hero?.mint ?? focus)) ?? null
    const attribution = heroInput ? attributeOpportunity(heroInput) : null
    const alerts = buildTerminalAlerts({
      intelEvents: seed.intel,
      brain,
      opportunities,
      nudges,
    })

    return {
      mode: 'demo',
      opportunities,
      actions,
      nudges,
      brain,
      hero,
      attribution,
      alerts,
      methodNote: 'opportunity-engine-v1 · causal-attribution-v1 · DEMO_SEED',
    }
  }

  // Live — portfolio brain when wallet loaded; opportunities empty until live SM/LP feed
  const brain = input.portfolioSummary
    ? buildLivePortfolioBrain(input.portfolioSummary)
    : null
  const opportunities: Opportunity[] = []
  const actions = buildActionQueue({
    brain,
    opportunities,
    focusMint: input.focusMint,
  })
  const nudges = buildWalletCoachNudges({
    positions: (input.portfolioSummary?.positions ?? []).map((p) => ({
      mint: p.mint,
      symbol: p.symbol,
      pnlPct: p.pnlPct ?? 0,
      riskScore: p.riskScore,
      verdict: p.verdict,
      valueUsd: p.valueUsd,
    })),
    brain,
    opportunities,
  })
  const alerts = buildTerminalAlerts({
    intelEvents: [], // honest — no fabricated market intel
    brain,
    opportunities,
    nudges,
  })

  return {
    mode: 'live',
    opportunities,
    actions,
    nudges,
    brain,
    hero: null,
    attribution: null,
    alerts,
    methodNote:
      'Live opportunity / causal feeds not yet wired — portfolio threats + coach only.',
  }
}
