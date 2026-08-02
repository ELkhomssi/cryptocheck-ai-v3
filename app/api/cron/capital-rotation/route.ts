import { NextRequest, NextResponse } from 'next/server'
import { runCapitalRotationTick } from '@/lib/terminal-os/rotation-workflow'
import { redis } from '@/lib/cache/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET|POST /api/cron/capital-rotation
 * Auth: Bearer CRON_SECRET
 * Scans watched wallets (index) and writes advise-only rotation proposals.
 * Never auto-executes sells.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const raw = await redis.get('ccai:tos:rotation:watchlist')
    let wallets: string[] = []
    if (raw) {
      try {
        wallets = JSON.parse(raw) as string[]
      } catch {
        wallets = []
      }
    }

    const results = []
    for (const wallet of wallets.slice(0, 12)) {
      const tick = await runCapitalRotationTick({
        wallet,
        permissionMode: 'advise_only',
      })
      results.push({
        wallet: wallet.slice(0, 6),
        proposed: Boolean(tick.proposal),
        skipped: tick.skippedReason,
      })
    }

    return NextResponse.json({
      ok: true,
      scanned: results.length,
      results,
      note: 'Advise-only — proposals require user confirmation. Never auto-sells.',
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'capital rotation cron failed' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest) {
  return run(req)
}

export async function POST(req: NextRequest) {
  return run(req)
}
