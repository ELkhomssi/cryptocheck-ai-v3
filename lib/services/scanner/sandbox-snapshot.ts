import { enrichScanBodyFromChain } from '@/lib/services/scanner/solana-token-enrichment'
import { runInstitutionalPipeline } from '@/lib/services/scanner/pipeline/run-institutional-scan'
import type { InstitutionalScanSnapshot } from '@/lib/services/scanner/types'

const DEMO_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

/**
 * Deterministic sandbox scan — same scoring engine as production, no serialized swap / RPC simulateTransaction path.
 */
export async function buildSandboxSnapshot(overrides: Record<string, unknown> = {}): Promise<InstitutionalScanSnapshot> {
  const body: Record<string, unknown> = {
    mint: DEMO_USDC,
    liquidityUsd: 8_500_000,
    topHolderPct: 12,
    pairAgeMinutes: 10080,
    mintAuthorityActive: false,
    creatorScamLinkedFundingCount: 0,
    ...overrides,
  }
  const prepared = await enrichScanBodyFromChain(body)
  return runInstitutionalPipeline(prepared)
}
