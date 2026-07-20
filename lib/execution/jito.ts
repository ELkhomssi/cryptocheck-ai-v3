/**
 * Jito execution module — tip planning + degradation.
 *
 * Reality check for this codebase today:
 * - Jupiter `/swap` accepts `prioritizationFeeLamports: { jitoTipLamports }`
 * - True Jito Block Engine bundle submission is optional and must never be
 *   assumed to land. Always design fallback → priority fee → RPC → abort.
 *
 * Non-custodial: tip instructions are embedded in the UNSIGNED tx the user signs.
 */

import type { JitoBundlePlan, OpportunityIntake } from './types'

export type CongestionLevel = 'low' | 'medium' | 'high' | 'extreme'

export function congestionFromRecentSlotLag(ms: number): CongestionLevel {
  if (ms >= 2_500) return 'extreme'
  if (ms >= 1_200) return 'high'
  if (ms >= 600) return 'medium'
  return 'low'
}

const TIP_MULTIPLIER: Record<CongestionLevel, number> = {
  low: 1,
  medium: 1.5,
  high: 2.5,
  extreme: 4,
}

/**
 * Dynamic tip: base from env, scaled by congestion and strategy aggressiveness.
 * Caps prevent tip griefing / capital bleed.
 */
export function planJitoExecution(
  opp: OpportunityIntake,
  opts: {
    congestion: CongestionLevel
    baseTipLamports?: number
    basePriorityLamports?: number
    enabled?: boolean
  },
): JitoBundlePlan {
  const enabled =
    opts.enabled ??
    (process.env.EXEC_JITO_ENABLED === 'true' || Number(process.env.SNIPER_JITO_TIP_LAMPORTS ?? 0) > 0)

  const baseTip =
    opts.baseTipLamports ??
    Number(process.env.SNIPER_JITO_TIP_LAMPORTS ?? process.env.EXEC_JITO_BASE_TIP_LAMPORTS ?? 0)
  const basePrio =
    opts.basePriorityLamports ??
    Number(process.env.SNIPER_PRIORITY_FEE_LAMPORTS ?? process.env.EXEC_PRIORITY_FEE_LAMPORTS ?? 0)

  const mult = TIP_MULTIPLIER[opts.congestion]
  const strategyBoost =
    opp.strategy === 'aggressive' ? 1.4 : opp.strategy === 'conservative' ? 0.7 : 1

  const tipLamports = Math.min(
    5_000_000,
    Math.floor(baseTip * mult * strategyBoost),
  )
  const priorityFeeLamports = Math.min(
    2_000_000,
    Math.floor(basePrio * Math.max(1, mult * 0.8)),
  )

  let fallback: JitoBundlePlan['fallback'] = 'jupiter_priority'
  if (opts.congestion === 'extreme') fallback = 'abort'
  else if (!enabled || tipLamports <= 0) fallback = 'rpc_send'

  return {
    enabled: enabled && tipLamports > 0,
    tipLamports,
    priorityFeeLamports,
    tipMultiplier: mult * strategyBoost,
    maxRetries: opts.congestion === 'high' || opts.congestion === 'extreme' ? 2 : 3,
    fallback,
  }
}

/**
 * Tradeoffs (documented for operators):
 *
 * | Path | Latency | Inclusion certainty | Cost | Failure mode |
 * |------|---------|---------------------|------|--------------|
 * | Jito tip via Jupiter | Medium | Higher in congestion | Tip burn | Bundle drop → retry/fallback |
 * | Priority fee only | Lower | Variable | CU price | Land late / expire |
 * | Plain RPC | Lowest cost | Worst under load | Base fee | Dropped tx |
 * | Abort | N/A | Safe | None | Missed opportunity |
 *
 * Institutional default: Balanced → tip+priority with jupiter_priority fallback.
 * Never treat bundle UUID as a fill — wait for confirmed signature.
 */
export function jitoPrioritizationOption(plan: JitoBundlePlan):
  | number
  | { jitoTipLamports: number }
  | 'auto'
  | undefined {
  if (plan.enabled && plan.tipLamports > 0) {
    return { jitoTipLamports: plan.tipLamports }
  }
  if (plan.priorityFeeLamports > 0) return plan.priorityFeeLamports
  if (plan.fallback === 'jupiter_priority') return 'auto'
  return undefined
}
