import { NextRequest, NextResponse } from 'next/server'
import { isValidSolanaMint } from '@/lib/validation/mint'
import { resolveScanAuthOnly } from '@/lib/auth/scan-access'
import { redis } from '@/lib/cache/redis'
import { getPortfolio } from '@/lib/portfolio/portfolio-tracker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CACHE_TTL_SEC = 60

/** GET /api/portfolio/[wallet] — positions + P&L + risk exposure. Auth: session or API key. */
export async function GET(req: NextRequest, { params }: { params: { wallet: string } }) {
  const auth = await resolveScanAuthOnly(req)
  if (auth.ok === false) return auth.response

  const wallet = params.wallet?.trim() ?? ''
  if (!isValidSolanaMint(wallet)) {
    return NextResponse.json({ error: 'Invalid wallet', code: 'INVALID_WALLET' }, { status: 400 })
  }
  const chain = req.nextUrl.searchParams.get('chain')?.trim() || 'solana'
  const cacheKey = `ccai:portfolio:${wallet}:${chain}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached), { status: 200, headers: { 'X-Cache': 'HIT' } })
    }
  } catch {
    /* cache miss */
  }

  const portfolio = await getPortfolio(wallet, chain)
  try {
    await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(portfolio))
  } catch {
    /* best-effort */
  }

  return NextResponse.json(portfolio, { status: 200, headers: { 'X-Cache': 'MISS' } })
}
