import type { UpgradePlanId } from '@/lib/billing/upgrade-plans'
import { stripePriceIdForPlan } from '@/lib/billing/upgrade-plans'

const PRICE_ID_RE = /^price_[a-zA-Z0-9]+$/
const PRODUCT_ID_RE = /^prod_[a-zA-Z0-9]+$/

function stripeSecret(): string | null {
  const k = process.env.STRIPE_SECRET_KEY?.trim()
  return k || null
}

export function stripeProductIdForPlan(planId: UpgradePlanId): string | null {
  const raw =
    planId === 'basic'
      ? process.env.STRIPE_PRODUCT_BASIC?.trim()
      : process.env.STRIPE_PRODUCT_PRO?.trim()
  if (!raw || !PRODUCT_ID_RE.test(raw)) return null
  return raw
}

/** In-memory cache: productId → default recurring priceId (per deploy). */
const productPriceCache = new Map<string, string>()

async function fetchDefaultRecurringPriceId(productId: string): Promise<string | null> {
  const cached = productPriceCache.get(productId)
  if (cached) return cached

  const secret = stripeSecret()
  if (!secret) return null

  const q = new URLSearchParams({
    product: productId,
    active: 'true',
    type: 'recurring',
    limit: '10',
  })

  const res = await fetch(`https://api.stripe.com/v1/prices?${q}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': '2024-04-10',
    },
    cache: 'no-store',
  })

  const body = (await res.json()) as {
    data?: Array<{ id?: string; recurring?: { interval?: string; interval_count?: number } }>
  }
  if (!res.ok) {
    console.error('[stripe-plan-prices] list prices failed', productId, body)
    return null
  }

  const prices = body.data ?? []
  const twoMonth =
    prices.find((p) => p.recurring?.interval === 'month' && p.recurring?.interval_count === 2) ??
    prices.find((p) => p.recurring?.interval === 'month') ??
    prices[0]

  const id = twoMonth?.id?.trim()
  if (!id || !PRICE_ID_RE.test(id)) return null

  productPriceCache.set(productId, id)
  return id
}

/**
 * Resolve Checkout `price_` id: explicit STRIPE_PRICE_* env, else default price on STRIPE_PRODUCT_*.
 */
export async function resolveStripePriceIdForPlan(planId: UpgradePlanId): Promise<string | null> {
  const fromEnv = stripePriceIdForPlan(planId)
  if (fromEnv) return fromEnv

  const productId = stripeProductIdForPlan(planId)
  if (!productId) return null

  return fetchDefaultRecurringPriceId(productId)
}

export function planIdFromStripeProductId(productId: string): UpgradePlanId | null {
  const basic = process.env.STRIPE_PRODUCT_BASIC?.trim()
  const pro = process.env.STRIPE_PRODUCT_PRO?.trim()
  if (basic && productId === basic) return 'basic'
  if (pro && productId === pro) return 'pro'
  return null
}

/** Webhook: match price id via env prices or Stripe Price → Product lookup. */
export async function resolvePlanIdFromStripePriceId(priceId: string): Promise<UpgradePlanId | null> {
  const { planIdFromStripePriceId } = await import('@/lib/billing/upgrade-plans')
  const fromEnv = planIdFromStripePriceId(priceId)
  if (fromEnv) return fromEnv

  const secret = stripeSecret()
  if (!secret) return null

  const res = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'Stripe-Version': '2024-04-10',
    },
    cache: 'no-store',
  })

  const body = (await res.json()) as { product?: string; error?: { message?: string } }
  if (!res.ok) {
    console.error('[stripe-plan-prices] retrieve price failed', priceId, body.error?.message)
    return null
  }

  const product =
    typeof body.product === 'string'
      ? body.product
      : body.product && typeof body.product === 'object' && 'id' in body.product
        ? String((body.product as { id: string }).id)
        : null

  return product ? planIdFromStripeProductId(product) : null
}

export async function isFullAccessStripePriceId(priceId: string): Promise<boolean> {
  return (await resolvePlanIdFromStripePriceId(priceId)) != null
}
