import { NextRequest, NextResponse } from 'next/server'
import { rescanMintForWatch } from '@/lib/personal-watch/runner'
import { collectMintUniverse } from '@/lib/personal-watch/mint-universe'
import { filterPremiumMintUniverse } from '@/lib/personal-watch/premium-universe'

export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/watch/trigger-mint
 * Event-driven rescan when a watched/held mint has on-chain activity (Helius hook).
 * Auth: CRON_SECRET or SIGNAL_WORKER_SECRET.
 */
export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { mint?: string; premiumOnly?: boolean }
  const mint = body.mint?.trim() ?? ''
  if (mint.length < 32) {
    return NextResponse.json({ error: 'mint required' }, { status: 400 })
  }

  if (body.premiumOnly !== false) {
    const universe = await collectMintUniverse()
    const filtered = await filterPremiumMintUniverse(universe)
    if (!filtered.mintToUsers.has(mint)) {
      return NextResponse.json({
        ok: true,
        scanned: false,
        reason: 'mint not in premium watch universe',
      })
    }
  }

  const result = await rescanMintForWatch(mint)
  return NextResponse.json({
    ok: true,
    mint,
    ...result,
    timestamp: new Date().toISOString(),
  })
}
