import { getProDashboardSession } from '@/lib/auth/pro-dashboard'
import { ScannerEngine } from '@/lib/services/scanner-engine'
import { buildWeightedSecurityScore } from '@/lib/services/scanner/weighted-score'
import { getPrimaryConnection } from '@/lib/services/scanner/RpcProviderManager'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'
import { ProDashboardClient } from './pro-dashboard-client'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'

export const dynamic = 'force-dynamic'

export default async function ProDashboardPage() {
  const reqLabel = `pro-dashboard:${Date.now().toString(36)}`
  console.time(`${reqLabel}:total`)

  const featuredMint = 'So11111111111111111111111111111111111111112'
  const fallbackCanonical = {
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

  // Keep first paint fast: don't let a slow upstream canonical scan block the dashboard.
  const canonicalWithTimeout = Promise.race([
    canonicalScan(featuredMint),
    new Promise<typeof fallbackCanonical>((resolve) =>
      setTimeout(() => resolve(fallbackCanonical), 2500)
    ),
  ])

  console.time(`${reqLabel}:parallel.session+canonical`)
  const [session, canonical] = await Promise.all([
    getProDashboardSession(),
    canonicalWithTimeout.catch((e) => {
      console.error('[pro/dashboard] canonicalScan fallback', {
        mint: featuredMint,
        error: e instanceof Error ? e.message : String(e),
      })
      return fallbackCanonical
    }),
  ])
  console.timeEnd(`${reqLabel}:parallel.session+canonical`)
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
  console.timeEnd(`${reqLabel}:total`)

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
