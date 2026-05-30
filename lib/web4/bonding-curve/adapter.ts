/**
 * Bridge between BigInt on-chain curve state and UI-friendly numbers.
 */

import type { BondingToken } from '@/app/dashboard/web4-terminal/pump-curve'
import {
  GRADUATION_SOL,
  LAMPORTS_PER_SOL,
  TOKEN_SCALE,
  TOTAL_SUPPLY_TOKENS,
  VIRTUAL_SOL_LAMPORTS,
  VIRTUAL_TOKEN_BASE,
} from './constants'
import {
  baseToTokens,
  initialCurveState,
  lamportsToSol,
  priceSolPerToken,
  progressPct,
  quoteBuy,
  quoteSell,
  solToLamports,
  tokensToBase,
  type CurveState,
} from './math'

export function curveStateFromToken(token: BondingToken): CurveState {
  return {
    virtualSolLamports: solToLamports(token.virtualSol),
    virtualTokenBase: tokensToBase(token.virtualToken),
    realSolLamports: solToLamports(token.realSolRaised),
    tokensSoldBase: tokensToBase(token.tokensSold),
    volumeLamports: solToLamports(token.volumeSol),
    graduated: token.graduated,
  }
}

export function tokenFromCurveState(
  base: Omit<BondingToken, 'virtualSol' | 'virtualToken' | 'realSolRaised' | 'tokensSold' | 'volumeSol' | 'graduated'>,
  state: CurveState,
): BondingToken {
  return {
    ...base,
    virtualSol: lamportsToSol(state.virtualSolLamports),
    virtualToken: baseToTokens(state.virtualTokenBase),
    realSolRaised: lamportsToSol(state.realSolLamports),
    tokensSold: baseToTokens(state.tokensSoldBase),
    volumeSol: lamportsToSol(state.volumeLamports),
    graduated: state.graduated,
  }
}

export function applyBuyToken(token: BondingToken, solIn: number, skipWallet = false) {
  const q = quoteBuy(curveStateFromToken(token), solToLamports(solIn))
  const next = tokenFromCurveState(token, q.next)
  return {
    tokensOut: baseToTokens(q.tokensOutBase),
    solSpent: skipWallet ? 0 : solIn,
    next,
    price: q.priceSolPerToken,
    graduated: q.graduated,
  }
}

export function applySellToken(token: BondingToken, tokenIn: number) {
  const q = quoteSell(curveStateFromToken(token), tokensToBase(tokenIn))
  return {
    solOut: lamportsToSol(q.solOutLamports),
    next: tokenFromCurveState(token, q.next),
    price: q.priceSolPerToken,
  }
}

export function quoteBuyToken(token: BondingToken, solIn: number) {
  return baseToTokens(quoteBuy(curveStateFromToken(token), solToLamports(solIn)).tokensOutBase)
}

export function quoteSellToken(token: BondingToken, tokenIn: number) {
  return lamportsToSol(quoteSell(curveStateFromToken(token), tokensToBase(tokenIn)).solOutLamports)
}

export function priceSolToken(token: BondingToken) {
  return priceSolPerToken(curveStateFromToken(token))
}

export function progressPctToken(token: BondingToken) {
  return progressPct(curveStateFromToken(token))
}

export {
  GRADUATION_SOL,
  LAMPORTS_PER_SOL,
  TOTAL_SUPPLY_TOKENS,
  VIRTUAL_SOL_LAMPORTS,
  VIRTUAL_TOKEN_BASE,
  initialCurveState,
  solToLamports,
  lamportsToSol,
  tokensToBase,
  baseToTokens,
}
