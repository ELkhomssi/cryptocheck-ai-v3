import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { resolveSignalWsUrl, signalFeedMode } from '@/lib/signal-aggregator/runtime-config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/signals/runtime-config
 * Client-safe feed transport — poll on Vercel-only; WebSocket when external gateway is set.
 */
export async function GET() {
  const mode = signalFeedMode()
  const wsUrl = resolveSignalWsUrl()

  return NextResponse.json(
    {
      mode,
      wsUrl: wsUrl || null,
      pollIntervalMs: Number(process.env.SIGNAL_POLL_INTERVAL_MS ?? 20_000),
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
