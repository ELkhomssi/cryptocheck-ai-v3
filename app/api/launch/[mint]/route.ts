import { NextResponse } from 'next/server'
import { PublicKey } from '@solana/web3.js'
import { getLaunchByMint } from '@/lib/launch/confirm-launch'
import { getLiquidityProvider } from '@/lib/launch/liquidity'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/launch/[mint] — single launch record + liquidity plan + explorer hints.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ mint: string }> | { mint: string } },
) {
  const params = await Promise.resolve(ctx.params)
  const mint = String(params.mint ?? '').trim()
  try {
    new PublicKey(mint)
  } catch {
    return NextResponse.json(
      { error: 'Valid mint required', compliance: LAUNCH_COMPLIANCE },
      { status: 400 },
    )
  }

  try {
    const launch = await getLaunchByMint(mint)
    if (!launch) {
      return NextResponse.json(
        { error: 'Launch not found', compliance: LAUNCH_COMPLIANCE },
        { status: 404 },
      )
    }
    const liquidity = await getLiquidityProvider('raydium-cpmm').planMigration({
      mint: launch.mint,
      poolId: launch.poolId ?? '',
    })
    return NextResponse.json(
      { launch, liquidity, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        compliance: LAUNCH_COMPLIANCE,
      },
      { status: 502 },
    )
  }
}
