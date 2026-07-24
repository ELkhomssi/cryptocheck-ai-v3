import { NextResponse } from 'next/server'
import { getTrendingFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/market/trending — Birdeye fetchTrending. */
export async function GET() {
  const body = await getTrendingFeed(20)
  return NextResponse.json(body)
}
