/**
 * Signal → Trade bridge. Turns a completed-scan / pulse entry into an actionable
 * TradeSignal with entry/exit guidance. NOT financial advice — risk-model suggestions only.
 */

import 'server-only'

import type { PulseEntry } from '@/lib/services/pulse-feed.service'
import { readReputation } from '@/lib/b2b/reputation-ledger'
import { fetchTokenMetrics } from '@/lib/dexscreener/fetch-token-metrics'

export interface TradeSignal {
  id: string
  mint: string
  chain: string
  signalType: 'BUY' | 'SELL' | 'WATCH' | 'AVOID'
  confidence: number
  riskScore: number
  entryPriceUsd?: number
  targetPriceUsd?: number
  stopLossPct?: number
  timeframeMinutes: number
  reasons: string[]
  generatedAt: string
  expiresAt: string
}

function classify(riskScore: number, verdict: string): TradeSignal['signalType'] {
  if (riskScore >= 80) return 'AVOID'
  if (riskScore >= 60) return 'WATCH'
  if (riskScore < 40 && verdict.toUpperCase() === 'SAFE') return 'BUY'
  return 'WATCH'
}

function timeframeFor(riskScore: number): number {
  // Lower-risk / established → longer validity window; risky/new → short.
  return riskScore < 31 ? 240 : 15
}

function stopLossFor(riskScore: number, signalType: TradeSignal['signalType']): number | undefined {
  if (signalType !== 'BUY') return undefined
  if (riskScore < 31) return 10
  if (riskScore < 60) return 15
  return undefined
}

/**
 * Enriches a pulse/scan entry with trade context. Reads the cached reputation ledger
 * (fast) for the risk score and DexScreener for current price; both are best-effort.
 */
export async function enrichSignalWithTradeContext(entry: PulseEntry): Promise<TradeSignal> {
  const mint = entry.mint
  const chain = 'solana'

  // 1. Prefer cached reputation-ledger risk score; fall back to (100 − safety) from the pulse entry.
  let riskScore = Math.max(0, Math.min(100, 100 - Math.round(entry.aggregateScore)))
  let confidence = Math.max(0, Math.min(100, Math.round(entry.aggregateScore)))
  try {
    const rep = await readReputation(chain, mint)
    if (rep) {
      riskScore = rep.riskScore
      confidence = rep.confidence > 0 ? rep.confidence : confidence
    }
  } catch {
    /* ledger optional */
  }

  // 2. Entry price context (best-effort).
  let entryPriceUsd: number | undefined
  try {
    const metrics = await fetchTokenMetrics(mint)
    if (metrics?.priceUsd && Number.isFinite(metrics.priceUsd)) entryPriceUsd = metrics.priceUsd
  } catch {
    /* price optional */
  }

  const signalType = classify(riskScore, entry.verdict)
  const timeframeMinutes = timeframeFor(riskScore)
  const stopLossPct = stopLossFor(riskScore, signalType)

  // 3. Target is a modest risk-model suggestion, only for BUY.
  const targetPriceUsd =
    signalType === 'BUY' && entryPriceUsd != null ? Number((entryPriceUsd * 1.25).toPrecision(6)) : undefined

  const reasons: string[] = [
    `Risk score ${riskScore}/100 (${entry.verdict}).`,
    signalType === 'BUY'
      ? 'Low risk + safe verdict — favorable entry per risk model.'
      : signalType === 'AVOID'
        ? 'Risk score above safe trading threshold.'
        : 'Elevated risk — monitor before any entry.',
  ]
  if (stopLossPct) reasons.push(`Suggested stop-loss: ${stopLossPct}%.`)

  const generatedAt = entry.ts || new Date().toISOString()
  const expiresAt = new Date(new Date(generatedAt).getTime() + timeframeMinutes * 60_000).toISOString()

  return {
    id: `sig_${mint}_${signalType}`,
    mint,
    chain,
    signalType,
    confidence,
    riskScore,
    entryPriceUsd,
    targetPriceUsd,
    stopLossPct,
    timeframeMinutes,
    reasons,
    generatedAt,
    expiresAt,
  }
}
