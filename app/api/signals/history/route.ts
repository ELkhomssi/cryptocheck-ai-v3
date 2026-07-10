import { NextRequest, NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'
import { fetchSignalHistoryForRequest } from '@/lib/signal-aggregator/feed-history'
import {
  resolveSignalRealtimeHttpBase,
  signalFeedMode,
  signalRealtimeIsExternal,
} from '@/lib/signal-aggregator/runtime-config'

export const dynamic = 'force-dynamic'

/** GET /api/signals/history — Supabase (Vercel-native) or proxy to external realtime gateway. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  const userId = req.nextUrl.searchParams.get('userId')?.trim() || undefined

  // Default on Vercel: read signal_normalized directly — no Railway/realtime worker required.
  if (!signalRealtimeIsExternal()) {
    try {
      const { tier, signals } = await fetchSignalHistoryForRequest({
        searchParams: req.nextUrl.searchParams,
        bearer: auth,
        userId,
      })
      return NextResponse.json(
        { tier, signals, compliance: SIGNAL_COMPLIANCE, mode: signalFeedMode() },
        {
          status: 200,
          headers: { 'cache-control': 'no-store', 'x-signal-compliance': SIGNAL_COMPLIANCE.disclaimer },
        },
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'History load failed'
      console.error('[signals/history] supabase', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  const base = resolveSignalRealtimeHttpBase()
  const url = new URL(`${base}/v1/history`)
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  if (auth) headers.authorization = `Bearer ${auth}`

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' })
    const body = await res.json()
    if (!res.ok) console.error('[signals/history] upstream', res.status, body)
    return NextResponse.json(body, {
      status: res.status,
      headers: { 'cache-control': 'no-store', 'x-signal-compliance': SIGNAL_COMPLIANCE.disclaimer },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'History proxy failed'
    console.error('[signals/history] proxy failed', { base, message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
