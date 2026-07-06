/**
 * 2-tier upgrade catalog — change prices/labels here without touching layout.
 * Stripe Price IDs come from env at checkout time (never hardcoded).
 */

export type UpgradePlanId = 'basic' | 'pro'

export type UpgradePlanConfig = {
  id: UpgradePlanId
  name: string
  /** Optional explicit price — resolved server-side from env */
  priceIdEnv: 'STRIPE_PRICE_BASIC' | 'STRIPE_PRICE_PRO'
  /** Stripe Product — default recurring price resolved at checkout if price env unset */
  productIdEnv: 'STRIPE_PRODUCT_BASIC' | 'STRIPE_PRODUCT_PRO'
  label: string
  bestValue?: boolean
}

export const PLANS: UpgradePlanConfig[] = [
  {
    id: 'basic',
    name: 'Basic Access',
    priceIdEnv: 'STRIPE_PRICE_BASIC',
    productIdEnv: 'STRIPE_PRODUCT_BASIC',
    label: '$10 / 2 months',
  },
  {
    id: 'pro',
    name: 'Pro Access',
    priceIdEnv: 'STRIPE_PRICE_PRO',
    productIdEnv: 'STRIPE_PRODUCT_PRO',
    label: '$25 / 2 months',
    bestValue: true,
  },
]

const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/

export function stripePriceIdForPlan(planId: UpgradePlanId): string | null {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) return null
  const raw =
    plan.priceIdEnv === 'STRIPE_PRICE_BASIC'
      ? process.env.STRIPE_PRICE_BASIC?.trim()
      : process.env.STRIPE_PRICE_PRO?.trim()
  if (!raw || !PRICE_ID_RE.test(raw)) return null
  return raw
}

export function planIdFromStripePriceId(priceId: string): UpgradePlanId | null {
  const basic = process.env.STRIPE_PRICE_BASIC?.trim()
  const pro = process.env.STRIPE_PRICE_PRO?.trim()
  if (basic && priceId === basic) return 'basic'
  if (pro && priceId === pro) return 'pro'
  return null
}

export function isFullAccessPriceId(priceId: string): boolean {
  return planIdFromStripePriceId(priceId) != null
}
