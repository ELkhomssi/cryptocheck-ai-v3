import { NextResponse } from 'next/server'
import { getNewLaunchesFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/market/new-launches — Birdeye + Raydium merge/dedupe by mint. */
export async function GET() {
  const body = await getNewLaunchesFeed(20)
  return NextResponse.json(body)
}
