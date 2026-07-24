import 'server-only'

import { listPendingOrders, updateOrder } from '@/lib/terminal/orders-store'
import { fetchTokenMarket } from '@/lib/providers/birdeye'
import { getJupiterQuote } from '@/lib/trading/jupiter-client'
import type { TerminalOrder } from '@/types/portfolio-desk'

const SOL_MINT = 'So11111111111111111111111111111111111111112'

async function priceUsdForMint(mint: string): Promise<number | null> {
  // Prefer Birdeye overview when keyed; else Jupiter quote vs SOL as last resort.
  try {
    const m = await fetchTokenMarket(mint)
    if (m && m.priceUsd > 0) return m.priceUsd
  } catch {
    /* continue */
  }

  if (mint === SOL_MINT) return null
  try {
    // 0.01 SOL → token; invert to USD-less relative price. Without SOL/USD we
    // only use this for limit/tp/sl against SOL-priced triggers when trigger
    // is stored as token price in USD from Birdeye — skip if no market price.
    const quote = await getJupiterQuote(SOL_MINT, mint, 10_000_000, 100)
    const out = Number(quote.outAmount)
    if (!(out > 0)) return null
    // Without SOL USD we cannot derive absolute USD; return null honestly.
    return null
  } catch {
    return null
  }
}

function triggerMet(order: TerminalOrder, priceUsd: number): boolean {
  const t = order.triggerPrice
  if (t == null || !(t > 0)) {
    // DCA: time-based — treat as trigger_hit once created > 0 and pending
    // (cron interval is the cadence). Honest: one shot per pending DCA row.
    return order.type === 'dca'
  }
  if (order.type === 'limit' || order.type === 'tp') {
    // Buy limit / take-profit sell: fire when market reaches trigger.
    // limit buy: price <= trigger; tp: price >= trigger (sell high)
    if (order.type === 'tp') return priceUsd >= t
    // limit: assume buy of output when price drops to trigger
    return priceUsd <= t
  }
  if (order.type === 'sl') {
    return priceUsd <= t
  }
  return false
}

/**
 * Check pending terminal orders against live prices.
 * On condition met → status = trigger_hit (user must still sign Jupiter swap).
 * Never marks filled without a wallet signature.
 * Expired rows (expires_at < now) → expired.
 */
export async function processTerminalOrders(limit = 50): Promise<{
  checked: number
  triggerHit: number
  expired: number
}> {
  const pending = await listPendingOrders(limit)
  let triggerHit = 0
  let expired = 0
  const now = Date.now()

  for (const order of pending) {
    if (order.expiresAt && Date.parse(order.expiresAt) < now) {
      await updateOrder(order.id, { status: 'expired' })
      expired += 1
      continue
    }

    // Price the output mint for buy limits; input mint for tp/sl exits.
    const priceMint =
      order.type === 'tp' || order.type === 'sl' ? order.inputMint : order.outputMint
    const price = await priceUsdForMint(priceMint)
    if (price == null && order.type !== 'dca') continue
    if (!triggerMet(order, price ?? 0)) continue

    await updateOrder(order.id, { status: 'trigger_hit' })
    triggerHit += 1
  }

  return { checked: pending.length, triggerHit, expired }
}
