import { NextRequest, NextResponse } from 'next/server'
import { fetchPortfolio } from '@/lib/helius-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { walletAddress?: string }
    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    if (!walletAddress || walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 })
    }
    const holdings = await fetchPortfolio(walletAddress)
    return NextResponse.json(holdings)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Portfolio fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
