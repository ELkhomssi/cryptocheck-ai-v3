import { NextRequest, NextResponse } from 'next/server'
import { getWeb4MarketSnapshot, WEB4_DEFAULT_MINT } from '@/lib/web4-terminal/market-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim() || WEB4_DEFAULT_MINT
  if (mint.length < 32) {
    return NextResponse.json({ error: 'Valid mint required' }, { status: 400 })
  }
  try {
    const snapshot = await getWeb4MarketSnapshot(mint)
    return NextResponse.json(snapshot)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Market fetch failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
