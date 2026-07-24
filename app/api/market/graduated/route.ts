import { NextResponse } from 'next/server'
import { getGraduatedFeed } from '@/lib/terminal/market-feeds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/market/graduated — Birdeye isGraduated filter, else new listings
 * with liquidity above the documented fallback threshold.
 */
export async function GET() {
  const body = await getGraduatedFeed(20)
  return NextResponse.json(body)
}
