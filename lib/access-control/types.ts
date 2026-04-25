/**
 * Trading OS feature flags — maps to product bands (NOT Stripe).
 * DB `ENTERPRISE` → `enterprise` (master key: Deep + Elite + all Trading OS).
 * Marketing UI stays "PRO MAX *"; tier strings are read-only from profiles / SaaS.
 */

export type ProductBand = 'none' | 'deep' | 'elite' | 'enterprise'

export type TradingOsFeature =
  | 'copilot'
  | 'rug_alerts'
  | 'copy_trading'
  | 'whale_alerts'
  | 'priority_signals'
  | 'deep_chain_intel'

/**
 * Deep band = PRO_MAX_DEEP only. Elite band = PRO_MAX_ELITE only.
 * `enterprise` (DB ENTERPRISE) is listed on every feature — full access.
 */
export const FEATURE_MATRIX: Record<TradingOsFeature, ProductBand[]> = {
  copilot: ['deep', 'enterprise'],
  rug_alerts: ['deep', 'enterprise'],
  deep_chain_intel: ['deep', 'enterprise'],
  copy_trading: ['elite', 'enterprise'],
  whale_alerts: ['elite', 'enterprise'],
  priority_signals: ['elite', 'enterprise'],
}
