import { NextRequest, NextResponse } from 'next/server'
import { uniqueMintCount } from '@/lib/personal-watch/degrade'

export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/watch/verify-dedupe
 * Dev/test helper: prove N users × 1 mint → 1 unique scan target.
 * Auth: CRON_SECRET or SIGNAL_WORKER_SECRET.
 */
export async function POST(req: NextRequest) {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    userCount?: number
    mint?: string
  }
  const userCount = Math.min(Math.max(Number(body.userCount) || 10, 1), 1000)
  const mint = (body.mint ?? 'So11111111111111111111111111111111111111112').trim()
  const map = new Map<string, Set<string>>()
  const users = new Set(Array.from({ length: userCount }, (_, i) => `u${i}`))
  map.set(mint, users)

  return NextResponse.json({
    ok: true,
    userCount,
    mint,
    uniqueMints: uniqueMintCount(map),
    evidence: `userCount=${userCount} → uniqueMints=${uniqueMintCount(map)} (must be 1 for single mint)`,
  })
}
