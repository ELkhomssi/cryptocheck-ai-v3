/**
 * 2-tier upgrade catalog with monthly + annual billing cycles.
 * Stripe Price IDs come from env at checkout time (never hardcoded).
 * Display amounts (USD) are safe to render client-side.
 */

export type UpgradePlanId = 'basic' | 'pro'
export type BillingCycle = 'monthly' | 'annual'

export type PlanCyclePricing = {
  /** Env var holding the Stripe price_ id for this plan+cycle. */
  priceIdEnv: string
  /** Display price in USD for this cycle (label/marketing + savings math only). */
  amountUsd: number
}

export type UpgradePlanConfig = {
  id: UpgradePlanId
  name: string
  /** Stripe Product — default recurring price resolved at checkout if price env unset. */
  productIdEnv: 'STRIPE_PRODUCT_BASIC' | 'STRIPE_PRODUCT_PRO'
  cycles: Record<BillingCycle, PlanCyclePricing>
  bestValue?: boolean
}

export const PLANS: UpgradePlanConfig[] = [
  {
    id: 'basic',
    name: 'Basic Access',
    productIdEnv: 'STRIPE_PRODUCT_BASIC',
    cycles: {
      monthly: { priceIdEnv: 'STRIPE_PRICE_BASIC', amountUsd: 10 },
      annual: { priceIdEnv: 'STRIPE_PRICE_BASIC_ANNUAL', amountUsd: 100 },
    },
  },
  {
    id: 'pro',
    name: 'Pro Access',
    productIdEnv: 'STRIPE_PRODUCT_PRO',
    cycles: {
      monthly: { priceIdEnv: 'STRIPE_PRICE_PRO', amountUsd: 20 },
      annual: { priceIdEnv: 'STRIPE_PRICE_PRO_ANNUAL', amountUsd: 200 },
    },
    bestValue: true,
  },
]

export const BILLING_CYCLES: BillingCycle[] = ['monthly', 'annual']

/** Marketing badge shown on annual plans (fixed copy, not the computed discount). */
export const ANNUAL_SAVINGS_BADGE_PCT = 20

const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/

function readEnvPrice(envName: string): string | null {
  const raw = process.env[envName]?.trim()
  if (!raw || !PRICE_ID_RE.test(raw)) return null
  return raw
}

export function getPlan(planId: UpgradePlanId): UpgradePlanConfig | null {
  return PLANS.find((p) => p.id === planId) ?? null
}

/** Explicit Stripe price_ id for a plan + cycle (env), if configured. */
export function stripePriceIdForPlan(
  planId: UpgradePlanId,
  cycle: BillingCycle = 'monthly',
): string | null {
  const plan = getPlan(planId)
  if (!plan) return null
  return readEnvPrice(plan.cycles[cycle].priceIdEnv)
}

/** Reverse lookup: which plan a price id belongs to (monthly OR annual). */
export function planIdFromStripePriceId(priceId: string): UpgradePlanId | null {
  for (const plan of PLANS) {
    for (const cycle of BILLING_CYCLES) {
      const env = readEnvPrice(plan.cycles[cycle].priceIdEnv)
      if (env && priceId === env) return plan.id
    }
  }
  return null
}

/** Reverse lookup: which billing cycle a price id belongs to. */
export function billingCycleFromStripePriceId(priceId: string): BillingCycle | null {
  for (const plan of PLANS) {
    for (const cycle of BILLING_CYCLES) {
      const env = readEnvPrice(plan.cycles[cycle].priceIdEnv)
      if (env && priceId === env) return cycle
    }
  }
  return null
}

/** True for any known full-access price id (monthly or annual, basic or pro). */
export function isFullAccessPriceId(priceId: string): boolean {
  return planIdFromStripePriceId(priceId) != null
}

/** Client-safe: annual discount vs paying monthly for a year (rounded %). */
export function annualSavingsPct(planId: UpgradePlanId): number {
  const plan = getPlan(planId)
  if (!plan) return 0
  const monthlyForYear = plan.cycles.monthly.amountUsd * 12
  if (monthlyForYear <= 0) return 0
  return Math.round((1 - plan.cycles.annual.amountUsd / monthlyForYear) * 100)
}
