import { NextResponse } from 'next/server'
import { getVolumeFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/market/volume — Birdeye token list by volume24hUSD desc. */
export async function GET() {
  const body = await getVolumeFeed(20)
  return NextResponse.json(body)
}
