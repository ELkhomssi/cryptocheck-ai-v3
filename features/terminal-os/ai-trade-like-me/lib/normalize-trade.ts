/**
 * Normalize CapturedTrade into V2 nested + flat dual shape.
 */

import type { CapturedTrade, TradeContextAtEntry } from '../types'
import type { ChainId } from '@/features/terminal-os/shared/types'

export type CapturedTradeInput = {
  id: string
  wallet: string
  tokenSymbol: string
  tokenMint: string
  chain: ChainId
  side?: 'buy' | 'sell' | 'reject'
  entryAt: string
  exitAt?: string | null
  entryPriceUsd: number
  exitPriceUsd?: number | null
  pnlPct?: number | null
  holdingDurationMs?: number | null
  positionSizeUsd: number
  marketCapUsd?: number | null
  liquidityUsd?: number | null
  volume24hUsd?: number | null
  volatilityPct?: number | null
  whaleActivityScore?: number | null
  walletScore?: number | null
  tokenScore?: number | null
  riskScore?: number | null
  socialMomentum?: number | null
  newsSentiment?: number | null
  gasFeeUsd?: number | null
  slippageBps?: number | null
  hourOfDay?: number
  dayOfWeek?: number
  wasRejectedOpportunity?: boolean
  rejectionReasonInferred?: string
  entryWhy?: string
  exitWhy?: string
  sample?: boolean
}

function entryTime(iso: string): { hourOfDay: number; dayOfWeek: number } {
  const d = new Date(iso)
  return { hourOfDay: d.getUTCHours(), dayOfWeek: d.getUTCDay() }
}

export function normalizeCapturedTrade(input: CapturedTradeInput): CapturedTrade {
  const rejected = Boolean(input.wasRejectedOpportunity || input.side === 'reject')
  const t = entryTime(input.entryAt)
  const hourOfDay = input.hourOfDay ?? t.hourOfDay
  const dayOfWeek = input.dayOfWeek ?? t.dayOfWeek
  const liq = input.liquidityUsd ?? 0
  const vol = input.volume24hUsd ?? 0
  const contextAtEntry: TradeContextAtEntry = {
    volatility24h: input.volatilityPct ?? 0,
    volumeToLiquidityRatio: liq > 0 ? vol / liq : 0,
    whaleActivityScore: input.whaleActivityScore ?? 0,
    walletScore: input.walletScore ?? 0,
    tokenScore: input.tokenScore ?? 0,
    riskScore: input.riskScore ?? 0,
    socialMomentum: input.socialMomentum ?? 0,
    newsSentiment: input.newsSentiment ?? 0,
    hourOfDay,
    dayOfWeek,
  }

  return {
    id: input.id,
    wallet: input.wallet,
    token: {
      symbol: input.tokenSymbol.toUpperCase(),
      address: input.tokenMint,
      chain: input.chain,
    },
    entry: {
      time: input.entryAt,
      price: input.entryPriceUsd,
      marketCap: input.marketCapUsd ?? 0,
      liquidity: liq,
    },
    exit:
      input.exitAt && input.exitPriceUsd != null
        ? { time: input.exitAt, price: input.exitPriceUsd }
        : undefined,
    positionSizeUsd: input.positionSizeUsd,
    pnlPct: input.pnlPct ?? undefined,
    holdingDurationMs: input.holdingDurationMs ?? undefined,
    contextAtEntry,
    execution: {
      gasFeeUsd: input.gasFeeUsd ?? 0,
      slippagePct: (input.slippageBps ?? 0) / 100,
    },
    wasRejectedOpportunity: rejected,
    rejectionReasonInferred: input.rejectionReasonInferred,
    entryWhy: input.entryWhy,
    exitWhy: input.exitWhy,
    sample: input.sample,

    tokenSymbol: input.tokenSymbol.toUpperCase(),
    tokenMint: input.tokenMint,
    chain: input.chain,
    side: rejected ? 'reject' : input.side === 'sell' ? 'sell' : 'buy',
    entryAt: input.entryAt,
    exitAt: input.exitAt ?? null,
    entryPriceUsd: input.entryPriceUsd,
    exitPriceUsd: input.exitPriceUsd ?? null,
    marketCapUsd: input.marketCapUsd ?? null,
    liquidityUsd: input.liquidityUsd ?? null,
    volume24hUsd: input.volume24hUsd ?? null,
    volatilityPct: input.volatilityPct ?? null,
    whaleActivityScore: input.whaleActivityScore ?? null,
    walletScore: input.walletScore ?? null,
    tokenScore: input.tokenScore ?? null,
    riskScore: input.riskScore ?? null,
    socialMomentum: input.socialMomentum ?? null,
    newsSentiment: input.newsSentiment ?? null,
    gasFeeUsd: input.gasFeeUsd ?? null,
    slippageBps: input.slippageBps ?? null,
    hourOfDay,
    dayOfWeek,
  }
}
