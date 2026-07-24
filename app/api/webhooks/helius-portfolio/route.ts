import { NextRequest, NextResponse } from 'next/server'
import { normalizeWebhookEvent } from '@/lib/portfolio-desk/alert-classify'
import { pushAlert } from '@/lib/portfolio-desk/alerts-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Helius webhook receiver for portfolio desk alerts.
 * Configure at docs.helius.dev/webhooks for large transfers, known-dev wallets,
 * and Raydium/Orca liquidity events. Optional shared secret:
 *   HELIUS_WEBHOOK_SECRET — compared to `Authorization` or `x-helius-secret`.
 *
 * Dedupe: alert id = signature:type[:mint] — upserted in alerts-store.
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
    const alert = normalizeWebhookEvent(ev)
    if (!alert) continue
    await pushAlert(alert)
    stored += 1
  }

  return NextResponse.json({ ok: true, stored })
}
