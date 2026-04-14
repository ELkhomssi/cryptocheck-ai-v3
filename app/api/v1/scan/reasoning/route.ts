import { NextRequest, NextResponse } from 'next/server'
import { withProFeature } from '@/lib/auth/pro-feature-access'
import { ScannerEngine } from '@/lib/services/scanner-engine'

export const dynamic = 'force-dynamic'

/**
 * Pro-only: full explainable reasoning payload (for integrations & terminal).
 */
export const POST = withProFeature(async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}))
    const mint = typeof body.mint === 'string' ? body.mint.trim() : ''
    if (!mint || mint.length < 32) {
      return NextResponse.json({ error: 'Invalid mint' }, { status: 400 })
    }

    const reasoning = ScannerEngine.analyze({
      mint,
      liquidityUsd: body.liquidityUsd ?? null,
      topHolderPct: body.topHolderPct ?? null,
      pairAgeMinutes: body.pairAgeMinutes ?? null,
      mintAuthorityActive: body.mintAuthorityActive ?? null,
      creatorWallet: body.creatorWallet ?? null,
      creatorScamLinkedFundingCount: body.creatorScamLinkedFundingCount ?? 0,
      signals: body.signals ?? {},
    })

    return NextResponse.json({ reasoning })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Scan failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
