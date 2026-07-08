import { NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { resolveSignalRealtimeHttpBase, resolveSignalWsUrl } from '@/lib/signal-aggregator/runtime-config'

export const dynamic = 'force-dynamic'

/**
 * GET /api/signals/runtime-config
 * Client-safe runtime URLs — avoids relying on NEXT_PUBLIC_* build-time inlining.
 */
export async function GET() {
  const httpBase = resolveSignalRealtimeHttpBase()
  const wsUrl = resolveSignalWsUrl()
  const isLocal =
    httpBase.includes('127.0.0.1') ||
    httpBase.includes('localhost') ||
    wsUrl.includes('localhost') ||
    wsUrl.includes('127.0.0.1')

  return NextResponse.json(
    {
      wsUrl,
      historyProxyConfigured: !isLocal,
      compliance: SIGNAL_COMPLIANCE,
    },
    { headers: { 'cache-control': 'no-store' } },
  )
}
