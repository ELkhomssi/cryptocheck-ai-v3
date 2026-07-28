/**
 * Pure whale enrichment for the marquee ticker — unit-testable, no network.
 * Derives confidence / impact / smart-money from live notional + classification.
 * Keep in sync with live-market whale mapper.
 */

import type {
  WhaleAction,
  WhaleClassification,
  WhaleDisplayAction,
  WhaleMovement,
} from '../types'

export const WHALE_HIGH_CONFIDENCE_MIN = 65
export const WHALE_RING_BUFFER_MAX = 256

export type WhaleEnrichInput = {
  id: string
  walletFull: string
  chain: WhaleMovement['chain']
  action: WhaleAction
  assetSymbol: string
  tokenLogoUrl?: string
  usdValue: number
  amount: number
  occurredAt: string
  classification?: WhaleClassification
  classificationWhy?: string
  /** Optional liquidity for impact ratio */
  liquidityUsd?: number
  /** Optional 24h volume for confidence */
  volume24hUsd?: number
  /** When true, fill attribution fields with deterministic sample values */
  sampleAttribution?: boolean
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function truncateWallet(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function walletAvatarInitials(addr: string): string {
  const clean = addr.replace(/[^a-zA-Z0-9]/g, '')
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase()
  return 'WH'
}

export function whaleDisplayAction(
  action: WhaleAction,
  classification: WhaleClassification,
): WhaleDisplayAction {
  if (classification === 'Possible Rug') return 'ALERT'
  if (action === 'buy' || action === 'deposit') return 'BUY'
  if (action === 'sell') return 'SELL'
  if (action === 'swap') return 'SWAP'
  return 'TRANSFER'
}

export function actionCssClass(display: WhaleDisplayAction): string {
  switch (display) {
    case 'BUY':
      return 'tos-wm-buy'
    case 'SELL':
      return 'tos-wm-sell'
    case 'SWAP':
      return 'tos-wm-swap'
    case 'ALERT':
      return 'tos-wm-alert'
    default:
      return 'tos-wm-transfer'
  }
}

/**
 * Score impact 0–100 from notional vs liquidity (or absolute size).
 */
export function computeImpactScore(usdValue: number, liquidityUsd?: number): number {
  if (liquidityUsd && liquidityUsd > 0) {
    const ratio = (usdValue / liquidityUsd) * 100
    return Math.round(clamp(ratio * 1.2 + Math.log10(Math.max(usdValue, 1)) * 8, 8, 100))
  }
  // Absolute notional curve: $100k→~35, $1M→~55, $10M→~78, $50M→~95
  const logScore = Math.log10(Math.max(usdValue, 1_000)) * 18
  return Math.round(clamp(logScore, 12, 100))
}

/**
 * AI confidence from size + optional volume corroboration + classification.
 */
export function computeAiConfidence(input: {
  usdValue: number
  volume24hUsd?: number
  classification: WhaleClassification
}): number {
  let score = 55
  if (input.usdValue >= 10_000_000) score += 26
  else if (input.usdValue >= 1_000_000) score += 20
  else if (input.usdValue >= 250_000) score += 14
  else if (input.usdValue >= 100_000) score += 9
  else if (input.usdValue >= 40_000) score += 5
  else score += 2

  const vol = input.volume24hUsd ?? 0
  if (vol >= 5_000_000) score += 12
  else if (vol >= 1_000_000) score += 9
  else if (vol >= 500_000) score += 6
  else if (vol >= 250_000) score += 4

  switch (input.classification) {
    case 'High Conviction Buy':
    case 'Accumulation':
      score += 6
      break
    case 'Possible Rug':
    case 'Exit Signal':
      score += 4
      break
    case 'Profit Taking':
    case 'Distribution':
      score += 2
      break
    default:
      break
  }
  return Math.round(clamp(score, 35, 99))
}

export function computeSmartMoneyScore(input: {
  classification: WhaleClassification
  aiConfidence: number
  impactScore: number
  action: WhaleAction
}): { score: number; smartMoney: boolean } {
  let score = Math.round(input.aiConfidence * 0.45 + input.impactScore * 0.35)
  if (
    input.classification === 'High Conviction Buy' ||
    input.classification === 'Accumulation'
  ) {
    score += 12
  }
  if (input.action === 'buy' || input.action === 'deposit') score += 6
  if (input.classification === 'Possible Rug') score -= 20
  score = Math.round(clamp(score, 5, 99))
  return { score, smartMoney: score >= 72 }
}

function defaultReasoning(m: {
  classification: WhaleClassification
  action: WhaleAction
  assetSymbol: string
  usdValue: number
  chain: string
  impactScore: number
  aiConfidence: number
}): string {
  const notional = m.usdValue >= 1_000_000
    ? `$${(m.usdValue / 1_000_000).toFixed(1)}M`
    : `$${Math.round(m.usdValue).toLocaleString()}`
  return `${m.classification}: ${m.action.toUpperCase()} flow of ${notional} in $${m.assetSymbol} on ${m.chain}. Impact ${m.impactScore}/100 · model confidence ${m.aiConfidence}%. Large relative notional can shift short-horizon order flow — treat as signal, not advice.`
}

/**
 * Completes a whale event for the marquee (scores + optional sample attribution).
 */
export function enrichWhaleMovement(
  input: WhaleEnrichInput,
  classify: (e: {
    action: WhaleAction
    usdValue: number
    classification?: WhaleClassification
  }) => WhaleClassification,
): WhaleMovement {
  const classification =
    input.classification ??
    classify({ action: input.action, usdValue: input.usdValue })
  const impactScore = computeImpactScore(input.usdValue, input.liquidityUsd)
  const aiConfidence = computeAiConfidence({
    usdValue: input.usdValue,
    volume24hUsd: input.volume24hUsd,
    classification,
  })
  const { score: smartMoneyScore, smartMoney } = computeSmartMoneyScore({
    classification,
    aiConfidence,
    impactScore,
    action: input.action,
  })
  const why =
    input.classificationWhy ??
    defaultReasoning({
      classification,
      action: input.action,
      assetSymbol: input.assetSymbol,
      usdValue: input.usdValue,
      chain: input.chain,
      impactScore,
      aiConfidence,
    })

  const h = hashString(input.walletFull + input.id)
  let previousHoldingsUsd: number | null = null
  let currentPortfolioUsd: number | null = null
  let historicalWinRatePct: number | null = null
  let pnlUsd: number | null = null
  let sample = false

  if (input.sampleAttribution) {
    sample = true
    previousHoldingsUsd = Math.round(input.usdValue * (1.2 + (h % 80) / 100))
    currentPortfolioUsd = Math.round(previousHoldingsUsd + input.usdValue * (input.action === 'sell' ? -0.4 : 0.55))
    historicalWinRatePct = 42 + (h % 41)
    pnlUsd = Math.round(input.usdValue * (((h % 60) - 20) / 100))
  }

  return {
    id: input.id,
    walletTruncated: truncateWallet(input.walletFull),
    walletFull: input.walletFull,
    chain: input.chain,
    action: input.action,
    assetSymbol: input.assetSymbol.toUpperCase(),
    tokenLogoUrl: input.tokenLogoUrl,
    usdValue: input.usdValue,
    amount: input.amount,
    occurredAt: input.occurredAt,
    classification,
    classificationWhy: why,
    aiConfidence,
    impactScore,
    smartMoneyScore,
    smartMoney,
    avatarInitials: walletAvatarInitials(input.walletFull),
    previousHoldingsUsd,
    currentPortfolioUsd,
    historicalWinRatePct,
    pnlUsd,
    aiReasoning: why,
    sample: sample || undefined,
  }
}

/** Merge newest events into a capped ring buffer (dedupe by id, newest first). */
export function mergeWhaleRing(
  prev: WhaleMovement[],
  incoming: WhaleMovement[],
  max = WHALE_RING_BUFFER_MAX,
): WhaleMovement[] {
  const map = new Map<string, WhaleMovement>()
  for (const w of incoming) map.set(w.id, w)
  for (const w of prev) {
    if (!map.has(w.id)) map.set(w.id, w)
  }
  return Array.from(map.values())
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, max)
}

export function filterHighConfidenceWhales(
  rows: WhaleMovement[],
  minConfidence = WHALE_HIGH_CONFIDENCE_MIN,
): WhaleMovement[] {
  return rows.filter((w) => w.aiConfidence >= minConfidence)
}
