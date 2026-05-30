import {
  BPS_DENOM,
  FEE_BPS,
  GRADUATION_LAMPORTS,
  LAMPORTS_PER_SOL,
  TOKEN_SCALE,
  VIRTUAL_SOL_LAMPORTS,
  VIRTUAL_TOKEN_BASE,
} from './constants'

export type CurveState = {
  virtualSolLamports: bigint
  virtualTokenBase: bigint
  realSolLamports: bigint
  tokensSoldBase: bigint
  volumeLamports: bigint
  graduated: boolean
}

export function initialCurveState(): CurveState {
  return {
    virtualSolLamports: VIRTUAL_SOL_LAMPORTS,
    virtualTokenBase: VIRTUAL_TOKEN_BASE,
    realSolLamports: 0n,
    tokensSoldBase: 0n,
    volumeLamports: 0n,
    graduated: false,
  }
}

export function constantK(state: CurveState): bigint {
  return state.virtualSolLamports * state.virtualTokenBase
}

export function priceSolPerToken(state: CurveState): number {
  if (state.virtualTokenBase <= 0n) return 0
  return Number(state.virtualSolLamports) / Number(state.virtualTokenBase)
}

export function progressPct(state: CurveState): number {
  if (state.graduated) return 100
  const pct = (Number(state.realSolLamports) / Number(GRADUATION_LAMPORTS)) * 100
  return Math.min(100, pct)
}

function feeLamports(amount: bigint): bigint {
  return (amount * FEE_BPS) / BPS_DENOM
}

export type BuyQuote = {
  tokensOutBase: bigint
  netSolLamports: bigint
  feeLamports: bigint
  next: CurveState
  priceSolPerToken: number
  graduated: boolean
}

export type SellQuote = {
  solOutLamports: bigint
  feeLamports: bigint
  next: CurveState
  priceSolPerToken: number
}

/** x·y = k buy: SOL in → tokens out */
export function quoteBuy(state: CurveState, solInLamports: bigint): BuyQuote {
  if (state.graduated || solInLamports <= 0n) {
    return {
      tokensOutBase: 0n,
      netSolLamports: 0n,
      feeLamports: 0n,
      next: state,
      priceSolPerToken: priceSolPerToken(state),
      graduated: state.graduated,
    }
  }

  const fee = feeLamports(solInLamports)
  const netSol = solInLamports - fee
  const k = constantK(state)
  const newVirtualSol = state.virtualSolLamports + netSol
  const newVirtualToken = k / newVirtualSol
  const tokensOut = state.virtualTokenBase - newVirtualToken

  const realSolRaised =
    state.realSolLamports + netSol > GRADUATION_LAMPORTS
      ? GRADUATION_LAMPORTS
      : state.realSolLamports + netSol
  const graduated = realSolRaised >= GRADUATION_LAMPORTS

  const next: CurveState = {
    ...state,
    virtualSolLamports: newVirtualSol,
    virtualTokenBase: newVirtualToken,
    realSolLamports: realSolRaised,
    tokensSoldBase: state.tokensSoldBase + tokensOut,
    volumeLamports: state.volumeLamports + solInLamports,
    graduated,
  }

  return {
    tokensOutBase: tokensOut,
    netSolLamports: netSol,
    feeLamports: fee,
    next,
    priceSolPerToken: priceSolPerToken(next),
    graduated,
  }
}

/** x·y = k sell: tokens in → SOL out */
export function quoteSell(state: CurveState, tokensInBase: bigint): SellQuote {
  if (state.graduated || tokensInBase <= 0n) {
    return {
      solOutLamports: 0n,
      feeLamports: 0n,
      next: state,
      priceSolPerToken: priceSolPerToken(state),
    }
  }

  const k = constantK(state)
  const newVirtualToken = state.virtualTokenBase + tokensInBase
  const newVirtualSol = k / newVirtualToken
  let grossSol = state.virtualSolLamports - newVirtualSol
  const fee = feeLamports(grossSol)
  const solOut = grossSol > fee ? grossSol - fee : 0n

  const realSolDelta = (solOut * 98n) / 100n
  const realSolRaised =
    state.realSolLamports > realSolDelta ? state.realSolLamports - realSolDelta : 0n

  const next: CurveState = {
    ...state,
    virtualSolLamports: newVirtualSol,
    virtualTokenBase: newVirtualToken,
    tokensSoldBase:
      state.tokensSoldBase > tokensInBase ? state.tokensSoldBase - tokensInBase : 0n,
    volumeLamports: state.volumeLamports + solOut,
    realSolLamports: realSolRaised,
  }

  return {
    solOutLamports: solOut,
    feeLamports: fee,
    next,
    priceSolPerToken: priceSolPerToken(next),
  }
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * Number(LAMPORTS_PER_SOL)))
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / Number(LAMPORTS_PER_SOL)
}

export function tokensToBase(tokens: number): bigint {
  return BigInt(Math.floor(tokens * Number(TOKEN_SCALE)))
}

export function baseToTokens(base: bigint): number {
  return Number(base) / Number(TOKEN_SCALE)
}
