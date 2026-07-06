import { NextRequest, NextResponse } from 'next/server'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'

export const dynamic = 'force-dynamic'

/** GET /api/signals/history — same-origin proxy to realtime gateway history API. */
export async function GET(req: NextRequest) {
  const base = (
    process.env.SIGNAL_REALTIME_URL?.trim() ||
    `http://127.0.0.1:${process.env.SIGNAL_REALTIME_PORT ?? 4102}`
  ).replace(/\/$/, '')

  const url = new URL(`${base}/v1/history`)
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v))

  const headers: Record<string, string> = {}
  const auth = req.headers.get('authorization')
  if (auth) headers.authorization = auth

  try {
    const res = await fetch(url.toString(), { headers, cache: 'no-store' })
    const body = await res.json()
    return NextResponse.json(body, {
      status: res.status,
      headers: { 'cache-control': 'no-store', 'x-signal-compliance': SIGNAL_COMPLIANCE.disclaimer },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'History proxy failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
