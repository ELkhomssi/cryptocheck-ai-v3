import { getProDashboardSession } from '@/lib/auth/pro-dashboard'
import { ScannerEngine } from '@/lib/services/scanner-engine'
import { buildWeightedSecurityScore } from '@/lib/services/scanner/weighted-score'
import { getPrimaryConnection } from '@/lib/services/scanner/RpcProviderManager'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'
import { ProDashboardClient } from './pro-dashboard-client'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

export const dynamic = 'force-dynamic'

export default async function ProDashboardPage() {
  const session = await getProDashboardSession()
  const featuredMint = 'So11111111111111111111111111111111111111112'
  const canonical = await canonicalScan(featuredMint).catch((e) => {
    console.error('[pro/dashboard] canonicalScan fallback', {
      mint: featuredMint,
      error: e instanceof Error ? e.message : String(e),
    })
    return {
      mint: featuredMint,
      riskScore: 50,
      verdict: 'CAUTION' as const,
      verdictReason: 'Live canonical scan temporarily unavailable; showing fallback demo.',
      signals: [],
      liquidity: {
        status: 'unverified' as const,
        reason: 'Live liquidity verification temporarily unavailable.',
      },
      authorities: {
        mint: 'unknown' as const,
        freeze: 'unknown' as const,
        update: 'unknown' as const,
      },
      topHolderConcentration: 0,
      generatedAt: new Date().toISOString(),
      cacheKey: `scan:canonical:v1:${featuredMint}:fallback`,
    }
  })
  const demoVerdict =
    canonical.verdict === 'AVOID' ? 'CRITICAL_RISK' : canonical.verdict === 'HIGH_RISK' ? 'HIGH_RISK' : canonical.verdict

  const demoReasoning = ScannerEngine.analyze({
    mint: featuredMint,
    liquidityUsd:
      canonical.liquidity.status === 'no_pair' || canonical.liquidity.status === 'unverified' ? 10_000 : 200_000,
    topHolderPct: canonical.topHolderConcentration,
    pairAgeMinutes: 10080, // keep stable demo age; live scans override this immediately
    mintAuthorityActive: canonical.authorities.mint !== 'renounced',
    creatorWallet: 'DemoCreator111111111111111111111111111111111111111',
    creatorScamLinkedFundingCount: 0,
  })
  demoReasoning.aggregateScore = canonical.riskScore
  demoReasoning.verdict = demoVerdict
  demoReasoning.evidence.unshift({
    id: 'ev_canonical_demo_liquidity',
    category: 'liquidity',
    label: 'Canonical liquidity status',
    riskContribution: canonical.liquidity.status === 'no_pair' || canonical.liquidity.status === 'unverified' ? 35 : 5,
    maxWeight: 100,
    detail: `${canonical.liquidity.status}: ${canonical.liquidity.reason}`,
  })

  const demoWeighted = buildWeightedSecurityScore(demoReasoning)
  const demoRpcLabel = getPrimaryConnection().label

  return (
    <>
      <DisclaimerBanner variant="default" />
      <ProDashboardClient
        session={session}
        demoReasoning={demoReasoning}
        demoWeighted={demoWeighted}
        demoRpcLabel={demoRpcLabel}
      />
    </>
  )
}
