import { NextRequest, NextResponse } from 'next/server'
import {
  PERSONAL_WATCH_INTERVAL_MIN,
  PERSONAL_WATCH_PREMIUM_INTERVAL_SEC,
  WATCH_FREE_DELAY_MS,
} from '@/lib/personal-watch/constants'
import { redis } from '@/lib/cache/redis'
import { WATCH_LAST_SCAN_REDIS_PREFIX } from '@/lib/personal-watch/constants'

export const dynamic = 'force-dynamic'

/**
 * GET /api/internal/watch/verify-premium
 * Evidence helper for Task 4 — interval constants + optional mint last-scan timestamp.
 * Auth: CRON_SECRET or SIGNAL_WORKER_SECRET.
 */
export async function GET(req: NextRequest) {
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const secret =
    process.env.SIGNAL_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ''
  if (!secret || header !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const mint = req.nextUrl.searchParams.get('mint')?.trim() ?? ''
  let lastScanIso: string | null = null
  let secondsSinceScan: number | null = null

  if (mint.length >= 32) {
    try {
      const raw = await redis.get(`${WATCH_LAST_SCAN_REDIS_PREFIX}${mint}`)
      if (raw) {
        const ts = Number(raw)
        if (Number.isFinite(ts)) {
          lastScanIso = new Date(ts).toISOString()
          secondsSinceScan = Math.round((Date.now() - ts) / 1000)
        }
      }
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({
    ok: true,
    verifiedAt: new Date().toISOString(),
    intervals: {
      freeCronMinutes: PERSONAL_WATCH_INTERVAL_MIN,
      premiumTargetSeconds: PERSONAL_WATCH_PREMIUM_INTERVAL_SEC,
      freeAlertDelayMs: WATCH_FREE_DELAY_MS,
      premiumMeaningfullyFaster:
        PERSONAL_WATCH_PREMIUM_INTERVAL_SEC < PERSONAL_WATCH_INTERVAL_MIN * 60,
    },
    mint: mint || null,
    lastScanIso,
    secondsSinceScan,
    evidenceNote:
      'Run free cron + premium cron twice; premium secondsSinceScan should stay ≤ premiumTargetSeconds while free stays ~600s.',
  })
}
