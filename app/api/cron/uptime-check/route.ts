import { NextRequest, NextResponse } from 'next/server'
import { recordUptimeProbe } from '@/lib/status/uptime-probes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Warms RPC + DexScreener + in-process route handlers to reduce cold starts.
 * Vercel Cron: every 5 minutes (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const host = req.headers.get('host') || 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const base = `${proto}://${host}`

  const results: Record<string, { ok: boolean; ms: number }> = {}

  async function ping(label: string, url: string) {
    const t0 = Date.now()
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) })
      results[label] = { ok: r.ok, ms: Date.now() - t0 }
    } catch {
      results[label] = { ok: false, ms: Date.now() - t0 }
    }
  }

  await Promise.all([
    ping('health', `${base}/api/health`),
    ping(
      'dexscreener',
      'https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112'
    ),
  ])

  const healthOk = results.health?.ok === true
  await recordUptimeProbe(healthOk)

  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() })
}
