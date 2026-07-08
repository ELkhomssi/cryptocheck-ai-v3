import type { BillingCycle, UpgradePlanId } from '@/lib/billing/upgrade-plans'
import { PLANS } from '@/lib/billing/upgrade-plans'
import { resolveStripePriceIdForPlan } from '@/lib/billing/stripe-plan-prices'
import { stripePriceIdForPlan } from '@/lib/billing/upgrade-plans'

const PRODUCT_ID_RE = /^prod_[a-zA-Z0-9]+$/
const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/

function envSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

function envLooksLike(name: string, re: RegExp): boolean | null {
  const raw = process.env[name]?.trim()
  if (!raw) return null
  return re.test(raw)
}

export type BillingEnvCheck = {
  name: string
  set: boolean
  /** When set but wrong shape (e.g. prod_ in a price_ slot). */
  validShape: boolean | null
}

export type BillingReadiness = {
  stripeSecretConfigured: boolean
  plans: Array<{
    plan: UpgradePlanId
    cycle: BillingCycle
    priceEnv: string
    productEnv: string
    priceFromEnv: boolean
    productSet: boolean
    productValid: boolean | null
    priceValidShape: boolean | null
    resolvedPriceId: string | null
  }>
  checkoutReady: boolean
  hints: string[]
}

export async function collectBillingReadiness(): Promise<BillingReadiness> {
  const hints: string[] = []
  const stripeSecretConfigured = envSet('STRIPE_SECRET_KEY')
  if (!stripeSecretConfigured) hints.push('STRIPE_SECRET_KEY is missing in Production.')

  const plans: BillingReadiness['plans'] = []

  for (const plan of PLANS) {
    for (const cycle of ['monthly', 'annual'] as BillingCycle[]) {
      const priceEnv = plan.cycles[cycle].priceIdEnv
      const productEnv =
        plan.id === 'basic'
          ? cycle === 'annual'
            ? 'STRIPE_PRODUCT_BASIC_ANNUAL'
            : 'STRIPE_PRODUCT_BASIC'
          : cycle === 'annual'
            ? 'STRIPE_PRODUCT_PRO_ANNUAL'
            : 'STRIPE_PRODUCT_PRO'

      const priceRaw = process.env[priceEnv]?.trim()
      const priceValidShape = priceRaw ? PRICE_ID_RE.test(priceRaw) : null
      if (priceRaw && !PRICE_ID_RE.test(priceRaw)) {
        hints.push(
          `${priceEnv} must be a Stripe price_ id — you may have pasted a prod_ id into the price slot. Use ${productEnv} for product ids.`,
        )
      }

      const productRaw = process.env[productEnv]?.trim()
      const productValid = productRaw ? PRODUCT_ID_RE.test(productRaw) : null
      if (productRaw && !PRODUCT_ID_RE.test(productRaw)) {
        hints.push(`${productEnv} must start with prod_.`)
      }

      const resolvedPriceId = await resolveStripePriceIdForPlan(plan.id, cycle)
      if (!resolvedPriceId) {
        hints.push(
          `Could not resolve ${plan.id}/${cycle}: set ${productEnv} (and optional ${priceEnv}) or ensure the product has an active ${cycle === 'annual' ? 'yearly' : 'monthly'} recurring price in Stripe.`,
        )
      }

      plans.push({
        plan: plan.id,
        cycle,
        priceEnv,
        productEnv,
        priceFromEnv: Boolean(stripePriceIdForPlan(plan.id, cycle)),
        productSet: envSet(productEnv),
        productValid,
        priceValidShape,
        resolvedPriceId: resolvedPriceId ? `${resolvedPriceId.slice(0, 12)}…` : null,
      })
    }
  }

  const checkoutReady = stripeSecretConfigured && plans.some((p) => p.resolvedPriceId != null)

  return { stripeSecretConfigured, plans, checkoutReady, hints: [...new Set(hints)] }
}

export function billingEnvChecklist(): BillingEnvCheck[] {
  const names = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PRODUCT_BASIC',
    'STRIPE_PRODUCT_PRO',
    'STRIPE_PRODUCT_BASIC_ANNUAL',
    'STRIPE_PRODUCT_PRO_ANNUAL',
    'STRIPE_PRICE_BASIC',
    'STRIPE_PRICE_PRO',
    'STRIPE_PRICE_BASIC_ANNUAL',
    'STRIPE_PRICE_PRO_ANNUAL',
  ]
  return names.map((name) => ({
    name,
    set: envSet(name),
    validShape:
      name.includes('PRODUCT')
        ? envLooksLike(name, PRODUCT_ID_RE)
        : name.includes('PRICE')
          ? envLooksLike(name, PRICE_ID_RE)
          : null,
  }))
}
