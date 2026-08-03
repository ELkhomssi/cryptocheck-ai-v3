/**
 * Layer 2 entry — produce the canonical Decision for a token context.
 * Layer 4 surfaces import this (or toCanonicalDecision + decide) instead of Layer 1 engines.
 */

import type { Decision, EngineId } from '@cryptocheck/decision-contracts'
import type { TokenRow, WhaleMovement } from '@/features/terminal-os/shared/types'
import type { MarketContext, TraderDna, UserWeightPrefs } from '../types'
import { buildMarketIntel } from '../engines/market-intelligence-engine'
import { decide } from '../engines/decision-engine'
import { toCanonicalDecision } from './to-canonical-decision'

export type DecideForTokenInput = {
  token: TokenRow
  whales?: WhaleMovement[]
  dna?: TraderDna | null
  tokenScore?: number
  riskScore?: number
  securityBand?: MarketContext['securityBand']
  hasOpenPosition?: boolean
  weightPrefs?: UserWeightPrefs
  teachRules?: string[]
  collectiveBoostPct?: number
  /** Extra unavailable engines beyond those inferred from missing inputs */
  unavailableEngines?: EngineId[]
}

function inferUnavailable(input: DecideForTokenInput): EngineId[] {
  const missing: EngineId[] = []
  if (!input.dna) missing.push('trader-dna')
  if (input.tokenScore == null && input.securityBand == null && input.riskScore == null) {
    missing.push('security-scanner')
  }
  if (!input.whales?.length) missing.push('whale-intelligence')
  // Portfolio never attached on token-only path
  missing.push('portfolio-intelligence')
  for (const e of input.unavailableEngines ?? []) {
    if (!missing.includes(e)) missing.push(e)
  }
  return missing
}

export function decideForToken(input: DecideForTokenInput): {
  explainable: ReturnType<typeof decide>
  decision: Decision
  intel: MarketContext
  degradedInputs: EngineId[]
} {
  const degradedInputs = inferUnavailable(input)
  const intel = buildMarketIntel({
    token: input.token,
    whales: input.whales,
    tokenScore: input.tokenScore,
    riskScore: input.riskScore,
    securityBand: input.securityBand,
  })
  const explainable = decide(input.dna ?? null, intel, {
    hasOpenPosition: input.hasOpenPosition,
    weightPrefs: input.weightPrefs,
    teachRules: input.teachRules,
    collectiveBoostPct: input.collectiveBoostPct,
    unavailableEngines: degradedInputs,
  })
  const decision = toCanonicalDecision(explainable, {
    degradedInputs,
    tokenAddress: input.token.id,
  })
  return { explainable, decision, intel, degradedInputs }
}
