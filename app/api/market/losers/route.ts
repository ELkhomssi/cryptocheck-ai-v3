import { NextResponse } from 'next/server'
import { getLosersFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/market/losers — Birdeye token list by 24h change asc (limit 20). */
export async function GET() {
  const body = await getLosersFeed(20)
  return NextResponse.json(body)
}
