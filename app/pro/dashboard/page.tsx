import { getProDashboardSession } from '@/lib/auth/pro-dashboard'
import { ScannerEngine } from '@/lib/services/scanner-engine'
import { buildWeightedSecurityScore } from '@/lib/services/scanner/weighted-score'
import { getPrimaryConnection } from '@/lib/services/scanner/RpcProviderManager'
import { ProDashboardClient } from './pro-dashboard-client'

export const dynamic = 'force-dynamic'

export default async function ProDashboardPage() {
  const session = await getProDashboardSession()

  const demoReasoning = ScannerEngine.analyze({
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    liquidityUsd: 8_500_000,
    topHolderPct: 12,
    pairAgeMinutes: 10080,
    mintAuthorityActive: false,
    creatorWallet: 'DemoCreator111111111111111111111111111111111111111',
    creatorScamLinkedFundingCount: 0,
  })

  const demoWeighted = buildWeightedSecurityScore(demoReasoning)
  const demoRpcLabel = getPrimaryConnection().label

  return (
    <ProDashboardClient
      session={session}
      demoReasoning={demoReasoning}
      demoWeighted={demoWeighted}
      demoRpcLabel={demoRpcLabel}
    />
  )
}
