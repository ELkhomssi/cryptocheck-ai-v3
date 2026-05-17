import { NextRequest, NextResponse } from 'next/server'
import { getWeb4Ohlcv, type Web4Timeframe } from '@/lib/web4-terminal/ohlcv-service'
import { WEB4_DEFAULT_MINT } from '@/lib/web4-terminal/market-service'

export const dynamic = 'force-dynamic'

const TIMEFRAMES = new Set<Web4Timeframe>(['1m', '5m', '15m', '1H', '4H', '1D', '1W'])

export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get('mint')?.trim() || WEB4_DEFAULT_MINT
  const tf = (req.nextUrl.searchParams.get('timeframe')?.trim() ?? '5m') as Web4Timeframe

  if (mint.length < 32) {
    return NextResponse.json({ error: 'Valid mint required' }, { status: 400 })
  }
  if (!TIMEFRAMES.has(tf)) {
    return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 })
  }

  try {
    const payload = await getWeb4Ohlcv(mint, tf)
    return NextResponse.json({ mint, timeframe: tf, ...payload })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'OHLCV fetch failed'
    return NextResponse.json({ error: message, candles: [] }, { status: 502 })
  }
}
