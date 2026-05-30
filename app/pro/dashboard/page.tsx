import { getProDashboardSession } from '@/lib/auth/pro-dashboard'
import { fetchFastScanForMint } from '@/lib/pro-dashboard/fetch-fast-scan'
import type { ScanV1ApiResponse } from '@/lib/types/institutional-scan-api'
import { ProDashboardClient } from './pro-dashboard-client'
import { DisclaimerBanner } from '@/components/legal/DisclaimerBanner'
import { SignalAlertFeed } from '@/components/trading/SignalAlertFeed'

export const dynamic = 'force-dynamic'

const FEATURED_MINT = 'So11111111111111111111111111111111111111112'

function fallbackDemoPayload(): ScanV1ApiResponse {
  return {
    score: 50,
    confidence: 0.45,
    risk_breakdown: { liquidity_risk: 35, wallet_risk: 20, contract_risk: 15 },
    reasoning: {
      aggregateScore: 50,
      confidenceScore: 45,
      verdict: 'CAUTION',
      institutionalGrade: 'C',
      evidence: [
        {
          id: 'ev_demo_fallback',
          category: 'liquidity',
          label: 'Demo fallback',
          riskContribution: 20,
          maxWeight: 100,
          detail: 'Live fast scan temporarily unavailable; showing static demo.',
        },
      ],
      flags: ['demo_fallback'],
      fingerprintBestMatch: null,
      clusterAnalysis: {
        linkedCreatorRisk: 'low',
        summary: 'Demo mode — connect API for live intelligence.',
        scamLinkedFundingHits: 0,
      },
    },
    wallet_reputation: { score0to100: 55, summary: 'Demo wallet reputation placeholder.' },
    simulator: {
      buy: { ok: true, path: 'demo', summary: 'Not run in fallback.' },
      sell: { ok: true, path: 'demo', summary: 'Not run in fallback.' },
      honeypotLikelihood: 'low',
      notes: 'Fallback demo payload.',
    },
    rpc_provider: 'demo (offline)',
    pipeline_stages: [],
    pipeline_ms: 0,
    last_updated: new Date().toISOString(),
    cache: 'miss',
    meta: {
      response_time_ms: 0,
      auth_via: 'session',
      user_id: 'public-demo',
    },
  }
}

function toClientProps(scan: ScanV1ApiResponse) {
  return {
    demoReasoning: scan.reasoning,
    demoWeighted: {
      score: scan.score,
      confidence: scan.confidence,
      risk_breakdown: scan.risk_breakdown,
    },
    demoRpcLabel: scan.rpc_provider,
  }
}

export default async function ProDashboardPage() {
  const reqLabel = `pro-dashboard:${Date.now().toString(36)}`
  console.time(`${reqLabel}:total`)

  const scanWithTimeout = Promise.race([
    fetchFastScanForMint(FEATURED_MINT),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ])

  console.time(`${reqLabel}:parallel.session+scan`)
  const [session, scanResult] = await Promise.all([getProDashboardSession(), scanWithTimeout])
  console.timeEnd(`${reqLabel}:parallel.session+scan`)

  const scan = scanResult ?? fallbackDemoPayload()
  if (!scanResult) {
    console.warn('[pro/dashboard] fast scan fallback', { mint: FEATURED_MINT })
  }

  const { demoReasoning, demoWeighted, demoRpcLabel } = toClientProps(scan)
  console.timeEnd(`${reqLabel}:total`)

  return (
    <>
      <DisclaimerBanner variant="default" />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <ProDashboardClient
            session={session}
            demoReasoning={demoReasoning}
            demoWeighted={demoWeighted}
            demoRpcLabel={demoRpcLabel}
          />
        </div>
        <aside className="w-full xl:sticky xl:top-6 xl:w-[360px] xl:shrink-0">
          <SignalAlertFeed locked={!session.hasDeepAccess} filter={{ chain: 'solana' }} />
        </aside>
      </div>
    </>
  )
}
