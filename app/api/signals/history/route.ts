import { NextRequest, NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { resolveSignalRealtimeHttpBase } from '@/lib/signal-aggregator/runtime-config'

export const dynamic = 'force-dynamic'

/** GET /api/signals/history — same-origin proxy to realtime gateway history API. */
export async function GET(req: NextRequest) {
  const base = resolveSignalRealtimeHttpBase()

  const url = new URL(`${base}/v1/history`)
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  if (auth) headers.authorization = auth

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' })
    const body = await res.json()
    if (!res.ok) {
      console.error('[signals/history] upstream', res.status, body)
    }
    return NextResponse.json(body, {
      status: res.status,
      headers: { 'cache-control': 'no-store', 'x-signal-compliance': SIGNAL_COMPLIANCE.disclaimer },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'History proxy failed'
    const looksLocal = base.includes('127.0.0.1') || base.includes('localhost')
    console.error('[signals/history] proxy failed', { base: looksLocal ? 'localhost' : base, message })
    return NextResponse.json(
      {
        error: looksLocal
          ? 'Signal realtime not configured — set SIGNAL_REALTIME_URL to your Railway realtime-gateway.'
          : message,
      },
      { status: 502 },
    )
  }
}
