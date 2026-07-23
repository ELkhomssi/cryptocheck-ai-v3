import { NextRequest, NextResponse } from 'next/server'
import { pushAlert } from '@/lib/portfolio-desk/alerts-store'
import type { PortfolioAlert, PortfolioAlertType } from '@/types/portfolio-desk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Helius webhook receiver for portfolio desk alerts.
 * Configure at docs.helius.dev/webhooks for large transfers, known-dev wallets,
 * and Raydium/Orca liquidity events. Optional shared secret:
 *   HELIUS_WEBHOOK_SECRET — compared to `Authorization` or `x-helius-secret`.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.HELIUS_WEBHOOK_SECRET?.trim()
  if (secret) {
    const auth =
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      req.headers.get('x-helius-secret') ||
      ''
    if (auth !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const events = Array.isArray(body) ? body : [body]
  let stored = 0

  for (const ev of events) {
    const alert = normalizeEvent(ev)
    if (!alert) continue
    pushAlert(alert)
    stored += 1
  }

  return NextResponse.json({ ok: true, stored })
}

function normalizeEvent(ev: unknown): PortfolioAlert | null {
  if (!ev || typeof ev !== 'object') return null
  const e = ev as Record<string, unknown>
  const typeRaw = String(e.type ?? e.eventType ?? 'transfer').toLowerCase()
  const type: PortfolioAlertType = typeRaw.includes('liq')
    ? 'liquidity'
    : typeRaw.includes('dev')
      ? 'dev_wallet'
      : typeRaw.includes('risk') || typeRaw.includes('rug')
        ? 'risk'
        : typeRaw.includes('smart')
          ? 'smart_money'
          : 'whale'

  const tokenSymbol =
    (typeof e.tokenSymbol === 'string' && e.tokenSymbol) ||
    (typeof e.symbol === 'string' && e.symbol) ||
    null
  const mint =
    (typeof e.mint === 'string' && e.mint) ||
    (typeof e.tokenAddress === 'string' && e.tokenAddress) ||
    null
  const description =
    (typeof e.description === 'string' && e.description) ||
    (typeof e.message === 'string' && e.message) ||
    JSON.stringify(e).slice(0, 180)
  const title =
    (typeof e.title === 'string' && e.title) ||
    (type === 'liquidity'
      ? 'Liquidity change'
      : type === 'dev_wallet'
        ? 'Dev wallet activity'
        : type === 'risk'
          ? 'High risk detected'
          : 'Whale activity')

  const id =
    (typeof e.signature === 'string' && e.signature) ||
    (typeof e.id === 'string' && e.id) ||
    `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    type,
    title,
    description,
    severity: type === 'risk' ? 'critical' : type === 'dev_wallet' ? 'warning' : 'info',
    tokenSymbol,
    mint,
    createdAt: new Date().toISOString(),
  }
}
