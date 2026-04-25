/**
 * Insider Exit Index (IEI) + neural adjustments from on-chain SPL facts and market context.
 * Pure helpers — RPC/HTTP fetching lives in the API route.
 */

export type ExitIntelFacts = {
  splMintAuthority: string | null
  splFreezeAuthority: string | null
  metadataUpdateAuthority: string | null
  top1Pct: number
  liquidityUsd: number
  volume24h: number
  priceChange24h: number
  buys24h: number
  sells24h: number
  pairAgeMin: number | null
  pairCreatedAtMs: number | null
}

/** SPL "mint renounced" — inflation path closed (colloquial trader definition). */
export function isSplMintRenounced(splMintAuthority: string | null): boolean {
  return splMintAuthority === null || splMintAuthority === undefined
}

/** Full SPL exit surface cleared (mint + freeze). */
export function isSplFullyRenounced(
  splMintAuthority: string | null,
  splFreezeAuthority: string | null
): boolean {
  return isSplMintRenounced(splMintAuthority) && (splFreezeAuthority === null || splFreezeAuthority === undefined)
}

/**
 * IEI 0–100 (higher = more insider / exit asymmetry).
 * When mint is renounced per user product rule, IEI is 0 even if metadata update remains
 * (metadata cannot mint tokens — we still surface update in rows from API).
 */
export function computeInsiderExitIndex(f: ExitIntelFacts): number {
  if (isSplMintRenounced(f.splMintAuthority)) {
    return 0
  }

  let iei = 18
  iei += 42 // inflation key live
  if (f.splFreezeAuthority) iei += 22
  if (f.metadataUpdateAuthority) iei += 8
  if (f.top1Pct > 60) iei += 18
  else if (f.top1Pct > 35) iei += 10
  else if (f.top1Pct > 20) iei += 5

  if (f.liquidityUsd > 0 && f.liquidityUsd < 15_000) iei += 12
  if (f.sells24h > f.buys24h * 1.4 && f.buys24h + f.sells24h > 20) iei += 8
  if (f.pairAgeMin !== null && f.pairAgeMin < 45) iei += 10

  return Math.max(0, Math.min(100, Math.round(iei)))
}

/** Neural safety score 0–100 (higher = safer) — aligned with Neural V4 / dashboard gauge. */
export function computeNeuralScoreFromExitFacts(f: ExitIntelFacts): number {
  if (isSplFullyRenounced(f.splMintAuthority, f.splFreezeAuthority)) {
    let s = 88
    if (f.top1Pct < 25) s += 6
    if (f.liquidityUsd > 100_000) s += 4
    if (!f.metadataUpdateAuthority) s += 2
    return Math.min(100, s)
  }

  let score = 52
  if (isSplMintRenounced(f.splMintAuthority)) {
    score += 16
    if (f.splFreezeAuthority) score -= 22
  } else {
    score -= 22
  }

  if (f.metadataUpdateAuthority) score -= 5

  if (f.top1Pct > 60) score -= 24
  else if (f.top1Pct > 35) score -= 12
  else if (f.top1Pct > 0) score += 8

  if (f.liquidityUsd > 500_000) score += 12
  else if (f.liquidityUsd > 100_000) score += 6
  else if (f.liquidityUsd > 10_000) score -= 4
  else if (f.liquidityUsd > 0) score -= 18

  if (f.priceChange24h < -65) score -= 16
  if (f.sells24h > f.buys24h * 1.5) score -= 8
  if (f.pairAgeMin !== null && f.pairAgeMin < 30) score -= 12
  if (f.pairAgeMin !== null && f.pairAgeMin > 60 * 24) score += 6

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Surveillance / fragility window end from DEX pair birth (DexScreener — not on-chain lock proof).
 * Only set when pool is young so traders get a time-boxed "acute" horizon.
 */
export function computeAcutePoolWindowEndMs(pairCreatedAtMs: number | null): number | null {
  if (!pairCreatedAtMs || Number.isNaN(pairCreatedAtMs)) return null
  const age = Date.now() - pairCreatedAtMs
  const windowMs = 72 * 3600000
  if (age >= windowMs) return null
  return pairCreatedAtMs + windowMs
}
