/**
 * GET /api/internal/provider-quota
 * Usage snapshot for external providers (Birdeye, Jupiter, Helius, …).
 * Server-only diagnostics — no secrets returned.
 */

import { NextResponse } from 'next/server'
import { getAllProviderUsage, getProviderQuotaConfig } from '@/lib/providers/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const usage = await getAllProviderUsage()
  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    providers: usage.map((u) => {
      const cfg = getProviderQuotaConfig(u.provider)
      const softMinute = Math.floor(u.minuteLimit * cfg.softRatio)
      const softDay = Math.floor(u.dayLimit * cfg.softRatio)
      const paused = u.pausedUntil > Date.now()
      return {
        ...u,
        softMinuteAt: softMinute,
        softDayAt: softDay,
        approachingMinute: u.minuteUsed >= softMinute,
        approachingDay: u.dayUsed >= softDay,
        paused,
        pauseRemainingMs: paused ? Math.max(0, u.pausedUntil - Date.now()) : 0,
      }
    }),
  })
}
