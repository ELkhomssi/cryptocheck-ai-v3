import { NextRequest, NextResponse } from 'next/server'
import { assembleIntelligenceChart } from '@/features/intelligence-chart/engines/assemble-chart-bundle'
import type { ChainId } from '@/features/terminal-os/shared/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHAINS = new Set<ChainId>(['solana', 'bnb', 'ethereum', 'base', 'arbitrum', 'all'])

/**
 * GET /api/terminal-os/intelligence-chart?query=WIF&chain=solana
 * Assembles Intelligence Chart bundle from real engines only.
 */
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get('query') || '').trim()
  const rawChain = (req.nextUrl.searchParams.get('chain') || 'all').toLowerCase() as ChainId
  const chain = CHAINS.has(rawChain) ? rawChain : 'all'

  if (!query) {
    return NextResponse.json({ error: 'query required', bundle: null }, { status: 400 })
  }

  try {
    const bundle = await assembleIntelligenceChart({ query, chain })
    if (!bundle) {
      return NextResponse.json({
        bundle: null,
        error: 'Token not resolved',
        source: 'intelligence-chart',
      })
    }
    return NextResponse.json({ bundle })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Chart assemble failed'
    return NextResponse.json({ bundle: null, error: message }, { status: 500 })
  }
}
