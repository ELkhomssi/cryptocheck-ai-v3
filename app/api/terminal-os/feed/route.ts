import { NextRequest, NextResponse } from 'next/server'
import {
  resilientCandles,
  resilientOverview,
  resilientSnapshots,
  resilientTicker,
  resilientTokens,
  resilientTraders,
  resilientWhales,
  warmTerminalOsCache,
} from '@/lib/terminal-os/resilient-feed'
import type { ChainId } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHAINS = new Set<ChainId>(['solana', 'bnb', 'ethereum', 'base', 'arbitrum', 'all'])

function chainParam(req: NextRequest): ChainId {
  const raw = (req.nextUrl.searchParams.get('chain') || 'all').toLowerCase() as ChainId
  return CHAINS.has(raw) ? raw : 'all'
}

/**
 * GET /api/terminal-os/feed?resource=…
 * Always 200 with envelope metadata (stale/demo/circuit) — never blank for demo.
 */
export async function GET(req: NextRequest) {
  const resource = (req.nextUrl.searchParams.get('resource') || 'ticker').toLowerCase()
  const chain = chainParam(req)
  const limit = Math.min(48, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 24) || 24))

  if (resource === 'warm') {
    const result = await warmTerminalOsCache()
    return NextResponse.json(result)
  }

  try {
    switch (resource) {
      case 'ticker': {
        const env = await resilientTicker()
        return NextResponse.json({ items: env.data, ...meta(env) })
      }
      case 'overview': {
        const env = await resilientOverview()
        return NextResponse.json({ item: env.data, ...meta(env) })
      }
      case 'tokens': {
        const env = await resilientTokens(chain, limit)
        return NextResponse.json({ items: env.data, chain, ...meta(env) })
      }
      case 'whales': {
        const env = await resilientWhales(limit)
        return NextResponse.json({ items: env.data, ...meta(env) })
      }
      case 'traders': {
        const env = await resilientTraders(limit)
        return NextResponse.json({ items: env.data, ...meta(env) })
      }
      case 'snapshots': {
        const env = await resilientSnapshots()
        return NextResponse.json({ items: env.data, ...meta(env) })
      }
      case 'candles': {
        const env = await resilientCandles(chain)
        return NextResponse.json({ items: env.data, chain, ...meta(env) })
      }
      default:
        return NextResponse.json({ error: 'Unknown resource', items: [] }, { status: 400 })
    }
  } catch (e) {
    // Absolute last resort — still 200 with empty + demo flag for UI soft-fail
    const message = e instanceof Error ? e.message : 'Feed error'
    return NextResponse.json({
      items: [],
      item: null,
      error: message,
      stale: true,
      demo: true,
      source: 'error-fallback',
      fetchedAt: new Date().toISOString(),
      ageSec: 0,
      circuit: 'open',
    })
  }
}

function meta(env: {
  source: string
  fetchedAt: string
  stale: boolean
  ageSec: number
  demo: boolean
  circuit: string
}) {
  return {
    source: env.source,
    fetchedAt: env.fetchedAt,
    stale: env.stale,
    ageSec: env.ageSec,
    demo: env.demo,
    circuit: env.circuit,
  }
}
