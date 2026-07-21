/**
 * DEMO_SEED measured inputs for Opportunity Engine.
 * These are labeled demo quantities — engine derives conviction (not JSX literals).
 */

import type { OpportunityMeasuredInputs } from './opportunity-engine'
import { getDemoSeed } from '../data/demo-seed'

/** Stable measured inputs for demo mode — engine derives scores. */
export function getDemoOpportunityInputs(): OpportunityMeasuredInputs[] {
  const seed = getDemoSeed()
  const bySym = Object.fromEntries(seed.discover.map((d) => [d.symbol, d]))

  const rows: OpportunityMeasuredInputs[] = [
    {
      mint: bySym.SOLCAT!.mint,
      symbol: 'SOLCAT',
      smartMoneyNetInflowUsd: 182_000,
      liquidityExpansionPct: 21,
      holderGrowthPct: 14,
      insiderClusterActive: false,
      poolAgeHours: 36,
      riskScore: 28,
    },
    {
      mint: bySym.AGENTX!.mint,
      symbol: 'AGENTX',
      smartMoneyNetInflowUsd: 74_000,
      liquidityExpansionPct: 12,
      holderGrowthPct: 9,
      insiderClusterActive: false,
      poolAgeHours: 96,
      riskScore: 22,
    },
    {
      mint: bySym.WHALE!.mint,
      symbol: 'WHALE',
      smartMoneyNetInflowUsd: 95_000,
      liquidityExpansionPct: 8,
      holderGrowthPct: 6,
      insiderClusterActive: false,
      poolAgeHours: 240,
      riskScore: 31,
    },
    {
      mint: bySym.NOODLE!.mint,
      symbol: 'NOODLE',
      smartMoneyNetInflowUsd: -41_000,
      liquidityExpansionPct: -38,
      holderGrowthPct: -6,
      insiderClusterActive: true,
      poolAgeHours: 180,
      riskScore: 71,
    },
    {
      mint: bySym.PEPEAI!.mint,
      symbol: 'PEPEAI',
      smartMoneyNetInflowUsd: 28_000,
      liquidityExpansionPct: 11,
      holderGrowthPct: 7,
      insiderClusterActive: false,
      poolAgeHours: 20,
      riskScore: 40,
    },
  ]
  return rows
}
