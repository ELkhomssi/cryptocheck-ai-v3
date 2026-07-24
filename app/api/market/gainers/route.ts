import { NextResponse } from 'next/server'
import { getGainersFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/market/gainers — Birdeye token list by 24h change desc (limit 20). */
export async function GET() {
  const body = await getGainersFeed(20)
  return NextResponse.json(body)
}
