/**
 * Revenue Dashboard contracts — every panel imports from here.
 * Maps to existing gateway / Jupiter / portfolio modules; do not duplicate scanner internals.
 */

import type { MintRiskAssessment } from '@/lib/connect/scan-gateway'
import type { SwapDecision, SwapIntent } from '@/lib/trading/risk-gated-swap'
import type { JupiterQuote } from '@/lib/trading/jupiter-client'

/** Consumer verdict chip — maps gateway HIGH_RISK/BLOCKED → DANGER for UI. */
export type RevenueVerdict = 'SAFE' | 'CAUTION' | 'DANGER'

export type ScanSignal = {
  id: string
  label: string
  weight: number
  detail: string
}

/**
 * Scan panel contract — produced from `assessRiskByMint` / scan gateway only.
 * Never fabricate scores; `sample` must be true for demo/sandbox data.
 */
export type ScanResult = {
  mint: string
  symbol: string
  name: string
  /** 0–100 safety score (higher = safer) — same semantics as gateway safetyScore. */
  safetyScore: number
  /** 0–100 risk score (higher = riskier) — gateway riskScore. */
  riskScore: number
  verdict: RevenueVerdict
  confidence: MintRiskAssessment['confidence']
  topSignals: ScanSignal[]
  evidenceLine: string
  scannedAt: string
  cache: 'hit' | 'miss'
  /** When true, UI must show a visible "sample" tag. */
  sample: boolean
}

export type PlatformFeeLine = {
  bps: number
  /** Fee amount in input token base units (lamports for SOL). */
  amountBase: string
  /** Human-readable fee in USD when price is known. */
  amountUsd?: number
  feeTokenAccount: string
}

/**
 * Live Jupiter quote + platform fee breakdown shown before confirmation.
 */
export type SwapQuote = {
  quote: JupiterQuote
  inputMint: string
  outputMint: string
  inputAmountBase: string
  outputAmountBase: string
  outputAmountMinBase: string
  priceImpactPct: number
  slippageBps: number
  routeLabel: string
  platformFee: PlatformFeeLine
  quotedAt: string
  expiresAt: string
}

export type SwapExecutionStatus = 'simulated' | 'signed' | 'confirmed' | 'failed'

/**
 * Result of a completed swap — only populated from real on-chain execution.
 */
export type SwapResult = {
  status: SwapExecutionStatus
  signature: string
  intent: SwapIntent
  decision: SwapDecision
  quote: SwapQuote
  /** Platform fee actually captured (from tx meta / fee account), not estimated. */
  feeCapturedBase: string
  feeCapturedUsd?: number
  walletAddress: string
  executedAt: string
  simulationPassed: boolean
}

/**
 * Persisted fee ledger row — written only after confirmed swaps (Prompt 4 reconciles on-chain).
 */
export type FeeRecord = {
  id: string
  signature: string
  walletAddress: string
  inputMint: string
  outputMint: string
  volumeUsd: number
  feeBps: number
  feeAmountBase: string
  feeAmountUsd?: number
  feeTokenAccount: string
  executedAt: string
  /** Heuristic only — never presented as ground truth. */
  humanWalletHeuristic?: 'likely_human' | 'likely_bot' | 'unknown'
  /** Optional link back to Master Feed signal row. */
  signalId?: string
}

export type PortfolioPosition = {
  mint: string
  symbol: string
  name: string
  balance: number
  valueUsd: number
  safetyScore: number
  riskScore: number
  verdict: RevenueVerdict
  concentrationPct: number
  scannedAt: string
  /** True when price/value is estimated rather than quoted. */
  estimated: boolean
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export type RevenueAlert = {
  id: string
  walletAddress: string
  mint: string
  symbol: string
  previousVerdict: RevenueVerdict
  currentVerdict: RevenueVerdict
  message: string
  severity: AlertSeverity
  createdAt: string
  read: boolean
  /** Deep-link into Trade Terminal with this mint pre-loaded. */
  terminalDeepLink: string
}

export type BadgeOrderStatus = 'pending' | 'paid' | 'scanned' | 'failed'

export type VerifiedBadgeOrder = {
  id: string
  mint: string
  amountUsd: number
  merchantWallet: string
  status: BadgeOrderStatus
  intentId?: string
  signature?: string
  payerWallet?: string
  createdAt: string
  paidAt?: string
  scannedAt?: string
  error?: string
}

export type VerifiedBadgeSnapshot = {
  mint: string
  orderId: string
  safetyScore: number
  riskScore: number
  verdict: RevenueVerdict
  paidAt: string
  scannedAt: string
  reportUrl: string
  payerWallet?: string
  paymentSignature?: string
}

export type LiveBadgePayload = {
  mint: string
  paid: boolean
  safetyScore: number
  riskScore: number
  verdict: RevenueVerdict
  scannedAt: string
  reportUrl: string
  disclaimer: string
}

/** Map gateway verdict bands to dashboard DANGER chip. */
export function toRevenueVerdict(
  gatewayVerdict: MintRiskAssessment['verdict']
): RevenueVerdict {
  if (gatewayVerdict === 'SAFE') return 'SAFE'
  if (gatewayVerdict === 'CAUTION') return 'CAUTION'
  return 'DANGER'
}

export function scanResultFromAssessment(
  mint: string,
  assessment: MintRiskAssessment,
  meta?: { symbol?: string; name?: string; sample?: boolean }
): ScanResult {
  const { snapshot } = assessment
  const evidence = snapshot.reasoning.evidence
    .slice()
    .sort((a, b) => b.riskContribution - a.riskContribution)
    .slice(0, 5)

  const topLine = evidence[0]

  return {
    mint,
    symbol: meta?.symbol ?? 'TOKEN',
    name: meta?.name ?? 'Unknown',
    safetyScore: assessment.safetyScore,
    riskScore: assessment.riskScore,
    verdict: toRevenueVerdict(assessment.verdict),
    confidence: assessment.confidence,
    topSignals: evidence.map((e) => ({
      id: e.id,
      label: e.label,
      weight: e.riskContribution,
      detail: e.detail,
    })),
    evidenceLine: topLine?.detail ?? snapshot.reasoning.clusterAnalysis.summary,
    scannedAt: new Date().toISOString(),
    cache: assessment.cache,
    sample: meta?.sample === true,
  }
}
