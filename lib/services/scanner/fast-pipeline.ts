/**
 * Fast institutional scan — skips simulator, fingerprint matching, and DexScreener
 * (Dex skipped in execute-scan). Used when body.depth === 'fast'.
 * Does not modify the frozen run-institutional-scan.ts pipeline.
 */

import { ScannerEngine, type ScannerEngineInput } from '@/lib/services/scanner-engine'
import { buildWeightedSecurityScore } from '@/lib/services/scanner/weighted-score'
import type {
  InstitutionalScanSnapshot,
  PipelineStageRecord,
  TransactionSimulatorResult,
} from '@/lib/services/scanner/types'
import { normalizeScanError, ScanServiceError } from '@/lib/services/scanner/ErrorHandler'

const FAST_STUB_SIMULATOR: TransactionSimulatorResult = {
  buy: { ok: true, path: 'fast', summary: 'Deferred in fast mode.' },
  sell: { ok: true, path: 'fast', summary: 'Deferred in fast mode.' },
  honeypotLikelihood: 'low',
  notes: 'Full transaction simulation skipped (depth=fast).',
}

function stage(
  name: InstitutionalScanSnapshot['stages'][0]['name'],
  ms: number,
  detail?: string
): PipelineStageRecord {
  return { name, durationMs: ms, ok: true, detail }
}

function buildInput(body: Record<string, unknown>): ScannerEngineInput {
  function numOrNull(v: unknown): number | null {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  function boolOrNull(v: unknown): boolean | null {
    if (v === true || v === false) return v
    return null
  }
  return {
    mint: String(body.mint ?? body.tokenAddress ?? '').trim(),
    liquidityUsd: numOrNull(body.liquidityUsd),
    topHolderPct: numOrNull(body.topHolderPct),
    pairAgeMinutes: numOrNull(body.pairAgeMinutes),
    mintAuthorityActive: boolOrNull(body.mintAuthorityActive),
    freezeAuthorityActive: boolOrNull(body.freezeAuthorityActive),
    regulatedIssuer: body.regulatedIssuer === true ? true : body.regulatedIssuer === false ? false : undefined,
    enrichmentConfidenceHint: numOrNull(body.enrichmentConfidenceHint),
    creatorWallet: typeof body.creatorWallet === 'string' ? body.creatorWallet : null,
    creatorScamLinkedFundingCount: Number(body.creatorScamLinkedFundingCount ?? 0) || 0,
    signals: (body.signals as ScannerEngineInput['signals']) ?? {},
  }
}

/** ~50–150ms target: engine scoring only, no RPC simulate / fingerprint cluster. */
export async function runFastInstitutionalPipeline(
  body: Record<string, unknown>
): Promise<InstitutionalScanSnapshot> {
  const t0 = Date.now()
  const s0 = Date.now()

  let input: ScannerEngineInput
  try {
    input = buildInput(body)
    if (!input.mint || input.mint.length < 32) {
      throw new ScanServiceError(
        'The provided Solana address is malformed.',
        'INVALID_MINT_ADDRESS',
        400,
        undefined,
        'INVALID_MINT_ADDRESS',
        'high'
      )
    }
  } catch (e) {
    if (e instanceof ScanServiceError) throw e
    throw normalizeScanError(e)
  }

  const scoreStart = Date.now()
  const reasoning = ScannerEngine.analyze(input)
  const weighted = buildWeightedSecurityScore(reasoning)

  const enrichmentFailed = body._enrichment_failed === true
  const walletScore = enrichmentFailed ? 45 : 60

  return {
    reasoning,
    weighted,
    walletReputation: {
      score0to100: walletScore,
      summary: enrichmentFailed
        ? 'Fast mode — limited on-chain data (enrichment degraded).'
        : 'Fast mode — creator cluster analysis deferred.',
    },
    rpcProviderLabel: enrichmentFailed ? 'public (enrichment degraded)' : 'fast-local',
    stages: [
      stage('token_data_fetch', Date.now() - s0, 'Normalized from enrichment body'),
      stage('wallet_analysis', 0, 'Deferred (fast)'),
      stage('liquidity_analysis', 0, 'DexScreener skipped (fast)'),
      stage('transaction_simulation', 0, 'Skipped (fast)'),
      stage('pattern_matching', 0, 'Fingerprint match skipped (fast)'),
      stage('scoring', Date.now() - scoreStart, 'ScannerEngine.analyze only'),
    ],
    simulator: FAST_STUB_SIMULATOR,
    totalPipelineMs: Date.now() - t0,
    updatedAt: new Date().toISOString(),
  }
}
