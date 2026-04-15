import {
  ScannerEngine,
  type ReasoningObject,
  type ScannerEngineInput,
  deriveTokenSignals,
  matchFingerprints,
  evaluateLinkedCreatorWallets,
} from '@/lib/services/scanner-engine'
import { buildWeightedSecurityScore } from '@/lib/services/scanner/weighted-score'
import { TransactionSimulator } from '@/lib/services/scanner/TransactionSimulator'
import { getPrimaryConnection, withRpcFailover } from '@/lib/services/scanner/RpcProviderManager'
import { simulateSerializedSwapTransaction, computeRealizedTaxFromQuotes } from '@/lib/services/swap-simulation'
import type {
  InstitutionalScanSnapshot,
  PipelineStageRecord,
  PipelineStageName,
} from '@/lib/services/scanner/types'
import { normalizeScanError, ScanServiceError } from '@/lib/services/scanner/ErrorHandler'

function stage(name: PipelineStageName, ms: number, ok: boolean, detail?: string): PipelineStageRecord {
  return { name, durationMs: ms, ok, detail }
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
    swapQuoteExpectedOut: numOrNull(body.swapQuoteExpectedOut),
    swapQuoteActualOut: numOrNull(body.swapQuoteActualOut),
    forceSimulationFailure: body.forceSimulationFailure === true,
    simulateSwapPassed:
      body.simulateSwapPassed === true ? true : body.simulateSwapPassed === false ? false : undefined,
  }
}

function hasDynamicLayer(body: Record<string, unknown>): boolean {
  const b64 = body.serializedSwapTransactionBase64
  if (typeof b64 === 'string' && b64.length > 0) return true
  if (body.swapQuoteExpectedOut != null || body.swapQuoteActualOut != null) return true
  return false
}

function walletReputation(input: ScannerEngineInput): { score0to100: number; summary: string } {
  const cluster = evaluateLinkedCreatorWallets({
    creatorWallet: input.creatorWallet,
    scamLinkedFundingCount: input.creatorScamLinkedFundingCount,
  })
  let score = 88
  if (cluster.risk === 'high') score = 22
  else if (cluster.risk === 'medium') score = 52
  if (!input.creatorWallet) score = Math.min(score, 55)
  return {
    score0to100: score,
    summary: `Wallet reputation (heuristic): ${cluster.detail}`,
  }
}

/**
 * Modular pipeline orchestrating fetch → wallet → liquidity notes → simulation placeholder → pattern → scoring.
 */
export async function runInstitutionalPipeline(
  body: Record<string, unknown>
): Promise<InstitutionalScanSnapshot> {
  const t0 = Date.now()
  const stages: PipelineStageRecord[] = []

  let input: ScannerEngineInput
  try {
    const s = Date.now()
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
    stages.push(stage('token_data_fetch', Date.now() - s, true, 'Mint and metrics normalized'))
  } catch (e) {
    if (e instanceof ScanServiceError) throw e
    throw normalizeScanError(e)
  }

  const wStart = Date.now()
  const walletRep = walletReputation(input)
  stages.push(stage('wallet_analysis', Date.now() - wStart, true, 'Creator / cluster heuristic'))

  const lStart = Date.now()
  stages.push(
    stage(
      'liquidity_analysis',
      Date.now() - lStart,
      true,
      input.liquidityUsd != null
        ? `Liquidity input ${Math.round(input.liquidityUsd)} USD (off-chain / caller supplied)`
        : 'Liquidity not supplied — confidence penalized in scoring'
    )
  )

  const simStart = Date.now()
  const simulator = TransactionSimulator.run(input)
  stages.push(stage('transaction_simulation', Date.now() - simStart, true, 'Structured dry-run'))

  const patStart = Date.now()
  const tokenSignals = deriveTokenSignals(input)
  const fp = matchFingerprints(tokenSignals)
  stages.push(
    stage(
      'pattern_matching',
      Date.now() - patStart,
      true,
      fp
        ? `Best fingerprint: ${fp.fingerprint.label} (${(fp.similarity * 100).toFixed(1)}% match)`
        : 'No strong fingerprint overlap'
    )
  )

  const scoreStart = Date.now()
  let reasoning: ReasoningObject
  let rpcLabel: string

  if (hasDynamicLayer(body)) {
    const base = ScannerEngine.analyze(input)
    const quoteTax = computeRealizedTaxFromQuotes(input.swapQuoteExpectedOut, input.swapQuoteActualOut)
    const serialized =
      typeof body.serializedSwapTransactionBase64 === 'string'
        ? body.serializedSwapTransactionBase64
        : undefined

    if (serialized && serialized.length > 0) {
      try {
        const { result: rpc, label } = await withRpcFailover(async (conn) =>
          simulateSerializedSwapTransaction(conn, serialized)
        )
        rpcLabel = label
        reasoning = ScannerEngine.applyDynamicSimulationLayer(base, { rpc, quoteTaxPct: quoteTax })
      } catch {
        const { label } = getPrimaryConnection()
        rpcLabel = `${label} (simulateTransaction degraded)`
        reasoning = ScannerEngine.applyDynamicSimulationLayer(base, { rpc: null, quoteTaxPct: quoteTax })
      }
    } else {
      rpcLabel = getPrimaryConnection().label
      reasoning = ScannerEngine.applyDynamicSimulationLayer(base, { rpc: null, quoteTaxPct: quoteTax })
    }
  } else {
    rpcLabel = getPrimaryConnection().label
    reasoning = ScannerEngine.analyze(input)
  }

  stages.push(stage('scoring', Date.now() - scoreStart, true, 'Weighted evidence + verdict'))

  const weighted = buildWeightedSecurityScore(reasoning)

  return {
    reasoning,
    weighted,
    walletReputation: walletRep,
    rpcProviderLabel: rpcLabel,
    stages,
    simulator,
    totalPipelineMs: Date.now() - t0,
    updatedAt: new Date().toISOString(),
  }
}
