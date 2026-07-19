import { NextResponse } from 'next/server'
import { confirmLaunch } from '@/lib/launch/confirm-launch'
import { LAUNCH_COMPLIANCE } from '@/lib/launch/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/launch/confirm
 * Body: { mint, signature, ...optional params }
 * Verifies on-chain pool.platformId === LAUNCHLAB_PLATFORM_ID,
 * auto-scans via Neural V4 gateway, persists to token_launches.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const mint = String(body.mint ?? '').trim()
  const signature = String(body.signature ?? '').trim()

  if (!mint || !signature) {
    return NextResponse.json({ error: 'mint and signature required' }, { status: 400 })
  }

  try {
    const record = await confirmLaunch({
      mint,
      signature,
      creatorWallet: typeof body.creatorWallet === 'string' ? body.creatorWallet : undefined,
      name: typeof body.name === 'string' ? body.name : undefined,
      ticker: typeof body.ticker === 'string' ? body.ticker : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
      supply: typeof body.supply === 'string' ? body.supply : undefined,
      totalSellA: typeof body.totalSellA === 'string' ? body.totalSellA : undefined,
      totalFundRaisingB:
        typeof body.totalFundRaisingB === 'string' ? body.totalFundRaisingB : undefined,
      solTarget: typeof body.solTarget === 'number' ? body.solTarget : undefined,
      curveType: typeof body.curveType === 'string' ? body.curveType : undefined,
      poolId: typeof body.poolId === 'string' ? body.poolId : undefined,
    })

    return NextResponse.json(
      { ok: true, launch: record, compliance: LAUNCH_COMPLIANCE },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.includes('does not match') || msg.includes('not found') ? 403 : 502
    return NextResponse.json({ error: msg, compliance: LAUNCH_COMPLIANCE }, { status })
  }
}
