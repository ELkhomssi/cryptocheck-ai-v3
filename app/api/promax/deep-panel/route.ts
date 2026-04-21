import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTokenExitIntelSnapshot, resolveTokenAccountOwners } from '@/lib/token-exit-intel-server'
import { userHasDeepLiveIntel } from '@/lib/promax/deep-live-access'
import {
  buildSecurityPulse,
  collectFundingFeePayers,
  computeClusterRiskPct,
  computeTimeToImpact,
  fetchLpForensicLines,
} from '@/lib/promax/deep-panel-insights'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await userHasDeepLiveIntel(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Deep live intel requires PRO MAX DEEP or PRO MAX ELITE tier.', code: 'DEEP_INTEL_TIER' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const mint = typeof body?.mint === 'string' ? body.mint.trim() : ''
    if (!mint || mint.length < 32) {
      return NextResponse.json({ error: 'Invalid mint' }, { status: 400 })
    }

    const snap = await fetchTokenExitIntelSnapshot(mint)
    if (snap.ok === false) {
      const { code, message } = snap.error
      const status = code === 'MINT_NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: message, code }, { status })
    }

    const { data } = snap
    const tokenAddrs = data.holderTokenAccounts.map((h) => h.address).filter(Boolean)
    const holderOwners = await resolveTokenAccountOwners(tokenAddrs)

    const devWallets = [data.splMintAuthority, data.metadataUpdateAuthority].filter(
      (x): x is string => typeof x === 'string' && x.length >= 32
    )

    const fundingFeePayers = await collectFundingFeePayers(
      holderOwners.filter((o): o is string => !!o),
      8
    )

    const cluster = computeClusterRiskPct({
      facts: data.facts,
      holderOwners,
      fundingFeePayers,
      devWallets,
    })

    const pulse = buildSecurityPulse(data.facts)
    const lp = await fetchLpForensicLines(data.pairAddress)
    const timeToImpact = computeTimeToImpact(data.facts, lp.burnOrTransferHits)

    return NextResponse.json({
      mint: data.mint,
      symbol: data.symbol,
      neuralScore: data.neuralScore,
      iei: data.iei,
      isSplMintRenounced: data.isSplMintRenounced,
      isSplFullyRenounced: data.isSplFullyRenounced,
      splMintAuthority: data.splMintAuthority,
      splFreezeAuthority: data.splFreezeAuthority,
      metadataUpdateAuthority: data.metadataUpdateAuthority,
      securityPulse: pulse.label,
      securityComplexity: pulse.complexity,
      clusterRiskPct: cluster.clusterRiskPct,
      holdersAnalyzed: cluster.holdersAnalyzed,
      sharedFundingMax: cluster.sharedFundingCount,
      devLinkedHolders: cluster.devLinkedHolders,
      top1Pct: data.facts.top1Pct,
      liquidityUsd: data.facts.liquidityUsd,
      pairAgeMin: data.facts.pairAgeMin,
      timeToImpact,
      acutePoolWindowEndMs: data.acutePoolWindowEndMs,
      lpForensicLines: lp.lines,
      dexUrl: data.dexUrl,
      scannedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[promax/deep-panel]', e)
    return NextResponse.json({ error: 'Deep panel upstream failure' }, { status: 502 })
  }
}
