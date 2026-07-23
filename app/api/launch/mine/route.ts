import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { listLaunches } from '@/lib/launch/confirm-launch'
import { getLiquidityProvider } from '@/lib/launch/liquidity'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/launch/mine?creator=<wallet>
 * Creator-centric launch history with liquidity migration plan.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const creator = url.searchParams.get('creator')?.trim() ?? ''
  const limit = Number(url.searchParams.get('limit') ?? 50)

  try {
    new PublicKey(creator)
  } catch {
    return NextResponse.json(
      { error: 'Valid creator wallet required', launches: [], compliance: LAUNCH_COMPLIANCE },
      { status: 400 },
    )
  }

  try {
    const launches = await listLaunches(limit, { creator })
    const provider = getLiquidityProvider('raydium-cpmm')
    const enriched = await Promise.all(
      launches.map(async (l) => {
        const plan = await provider.planMigration({
          mint: l.mint,
          poolId: l.poolId ?? '',
        })
        return { ...l, liquidity: plan }
      }),
    )
    return NextResponse.json(
      { launches: enriched, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        launches: [],
        error: e instanceof Error ? e.message : String(e),
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 502 },
    )
  }
}
