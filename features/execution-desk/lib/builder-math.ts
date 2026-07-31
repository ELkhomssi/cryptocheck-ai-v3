/**
 * Execution Builder math — pure, testable formulas.
 * Recompute on every keystroke / price tick.
 */

import type { ExecutionBuilderState, ExecutionSide, OrderType, TokenRef } from '../types'

export type BuilderInputs = {
  wallet: string
  token: TokenRef
  side: ExecutionSide
  orderType: OrderType
  amountUsd: number
  slippageToleranceBps: number
  gasEstimateUsd: number
  priorityFeeUsd: number
  currentPrice: number
  stopLoss: number | null
  takeProfit: number | null
}

/** positionSizeUnits = amountUsd / currentPrice */
export function positionSizeUnits(amountUsd: number, currentPrice: number): number {
  if (!(currentPrice > 0) || !(amountUsd >= 0)) return 0
  return amountUsd / currentPrice
}

/**
 * riskPct = |entry - stopLoss| / entry as % of position
 * Buy: (entry - stop) / entry; Sell: (stop - entry) / entry
 */
export function riskPct(
  side: ExecutionSide,
  entry: number,
  stopLoss: number | null,
): number | null {
  if (stopLoss == null || !(entry > 0)) return null
  const dist = side === 'buy' ? entry - stopLoss : stopLoss - entry
  if (dist <= 0) return null
  return (dist / entry) * 100
}

/**
 * riskRewardRatio = reward / risk
 * Buy: (tp - entry) / (entry - sl)
 */
export function riskRewardRatio(
  side: ExecutionSide,
  entry: number,
  stopLoss: number | null,
  takeProfit: number | null,
): number | null {
  if (stopLoss == null || takeProfit == null || !(entry > 0)) return null
  const risk = side === 'buy' ? entry - stopLoss : stopLoss - entry
  const reward = side === 'buy' ? takeProfit - entry : entry - takeProfit
  if (risk <= 0 || reward <= 0) return null
  return reward / risk
}

export function expectedProfitUsd(
  side: ExecutionSide,
  units: number,
  entry: number,
  takeProfit: number | null,
): number | null {
  if (takeProfit == null || !(units > 0) || !(entry > 0)) return null
  const per = side === 'buy' ? takeProfit - entry : entry - takeProfit
  if (per <= 0) return null
  return units * per
}

export function expectedLossUsd(
  side: ExecutionSide,
  units: number,
  entry: number,
  stopLoss: number | null,
): number | null {
  if (stopLoss == null || !(units > 0) || !(entry > 0)) return null
  const per = side === 'buy' ? entry - stopLoss : stopLoss - entry
  if (per <= 0) return null
  return units * per
}

/**
 * totalEstimatedCostUsd =
 *   amountUsd + gas + priority + (amountUsd * slippageBps / 10000)
 */
export function totalEstimatedCostUsd(
  amountUsd: number,
  gasEstimateUsd: number,
  priorityFeeUsd: number,
  slippageToleranceBps: number,
): number {
  const slip = amountUsd * (Math.max(0, slippageToleranceBps) / 10_000)
  return Math.max(0, amountUsd) + Math.max(0, gasEstimateUsd) + Math.max(0, priorityFeeUsd) + slip
}

/**
 * Default slippage from liquidity depth (USD).
 * Thin books → wider tolerance; deep books → tighter.
 */
export function defaultSlippageBpsFromLiquidity(liquidityUsd: number): number {
  if (!(liquidityUsd > 0)) return 300
  if (liquidityUsd < 50_000) return 200
  if (liquidityUsd < 250_000) return 100
  if (liquidityUsd < 1_000_000) return 75
  return 50
}

export function computeBuilderState(input: BuilderInputs): ExecutionBuilderState {
  const units = positionSizeUnits(input.amountUsd, input.currentPrice)
  return {
    ...input,
    positionSizeUnits: units,
    riskPct: riskPct(input.side, input.currentPrice, input.stopLoss),
    riskRewardRatio: riskRewardRatio(
      input.side,
      input.currentPrice,
      input.stopLoss,
      input.takeProfit,
    ),
    expectedProfitUsd: expectedProfitUsd(
      input.side,
      units,
      input.currentPrice,
      input.takeProfit,
    ),
    expectedLossUsd: expectedLossUsd(
      input.side,
      units,
      input.currentPrice,
      input.stopLoss,
    ),
    totalEstimatedCostUsd: totalEstimatedCostUsd(
      input.amountUsd,
      input.gasEstimateUsd,
      input.priorityFeeUsd,
      input.slippageToleranceBps,
    ),
  }
}
