/**
 * GET /api/terminal/provider-health
 * Server-side reachability probes for Helius / Jupiter / Birdeye.
 * Never exposes API keys — only ok/latency/error reason.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

type Probe = {
  id: 'helius' | 'jupiter' | 'birdeye'
  label: string
  ok: boolean
  configured: boolean
  latencyMs: number | null
  detail: string
}

type TimedOk<T> = { ok: true; value: T; ms: number }
type TimedErr = { ok: false; ms: number; error: string }

async function timed<T>(fn: () => Promise<T>): Promise<TimedOk<T> | TimedErr> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { ok: true, value, ms: Date.now() - t0 }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : 'failed' }
  }
}

function detailOf(r: TimedOk<unknown> | TimedErr, okLabel: string): string {
  if (r.ok === true) return okLabel
  return r.error
}

export async function GET() {
  const probes: Probe[] = []

  {
    const configured = Boolean(process.env.JUPITER_API_KEY?.trim())
    const r = await timed(async () => {
      const { fetchPrices } = await import('@/lib/providers/jupiter')
      const map = await fetchPrices(['So11111111111111111111111111111111111111112'])
      if (!map.size) throw new Error('empty price response')
      return map
    })
    probes.push({
      id: 'jupiter',
      label: 'Jupiter',
      configured: true,
      ok: r.ok,
      latencyMs: r.ms,
      detail: detailOf(r, configured ? 'ok (keyed)' : 'ok (public)'),
    })
  }

  {
    const configured = Boolean(process.env.BIRDEYE_API_KEY?.trim())
    if (!configured) {
      probes.push({
        id: 'birdeye',
        label: 'Birdeye',
        configured: false,
        ok: false,
        latencyMs: null,
        detail: 'BIRDEYE_API_KEY not set',
      })
    } else {
      const r = await timed(async () => {
        const { fetchTrending } = await import('@/lib/providers/birdeye')
        const rows = await fetchTrending(1)
        if (!rows.length) throw new Error('empty trending response')
        return rows
      })
      probes.push({
        id: 'birdeye',
        label: 'Birdeye',
        configured: true,
        ok: r.ok,
        latencyMs: r.ms,
        detail: detailOf(r, 'ok'),
      })
    }
  }

  {
    const configured = Boolean(
      process.env.HELIUS_RPC_URL?.trim() || process.env.HELIUS_API_KEY?.trim(),
    )
    if (!configured) {
      probes.push({
        id: 'helius',
        label: 'Helius',
        configured: false,
        ok: false,
        latencyMs: null,
        detail: 'HELIUS_RPC_URL / HELIUS_API_KEY not set',
      })
    } else {
      const r = await timed(async () => {
        const { rpc } = await import('@/lib/providers/helius')
        const slot = await rpc('getSlot', [])
        if (slot == null) throw new Error('null slot')
        return slot
      })
      probes.push({
        id: 'helius',
        label: 'Helius',
        configured: true,
        ok: r.ok,
        latencyMs: r.ms,
        detail: detailOf(r, 'ok'),
      })
    }
  }

  return NextResponse.json({
    providers: probes,
    fetchedAt: new Date().toISOString(),
  })
}
