import { NextRequest, NextResponse } from 'next/server'
import { getWeb4Portfolio } from '@/lib/web4-terminal/portfolio-service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { walletAddress?: string }
    const walletAddress =
      typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    if (walletAddress.length < 32) {
      return NextResponse.json({ error: 'Valid wallet address required' }, { status: 400 })
    }
    const snapshot = await getWeb4Portfolio(walletAddress)
    return NextResponse.json(snapshot)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Portfolio fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
