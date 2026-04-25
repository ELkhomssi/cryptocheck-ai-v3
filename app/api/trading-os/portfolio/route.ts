import { NextRequest, NextResponse } from 'next/server'
import { computeWalletPortfolioValuation } from '@/lib/trading-os/portfolio-valuation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/trading-os/portfolio?wallet=<base58>
 * Live SPL + native SOL balances (Helius/Solana RPC) and USD prices (DexScreener). No DB writes.
 */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet')?.trim() ?? ''
  if (!wallet) {
    return NextResponse.json({ error: 'Missing required query: wallet' }, { status: 400 })
  }

  try {
    const body = await computeWalletPortfolioValuation(wallet)
    return NextResponse.json(body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'INVALID_WALLET') {
      return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 })
    }
    console.error('[trading-os/portfolio]', e)
    return NextResponse.json({ error: msg || 'Portfolio fetch failed' }, { status: 502 })
  }
}
