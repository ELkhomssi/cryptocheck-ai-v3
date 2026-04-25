import 'server-only'

import { randomUUID } from 'crypto'
import { redis } from '@/lib/cache/redis'
import { fetchTokenMetricsWithPair } from '@/lib/dexscreener/fetch-token-metrics'
import { buildTokenIntelligenceReport } from '@/lib/intelligence/fetch-token-intelligence'
import { detectLiquidityLock } from '@/lib/sentinel/liquidity-lock'
import { scoreToVerdict } from '@/lib/sentinel/verdict-thresholds'
import type { CanonicalScanResult, SignalEntry } from '@/lib/types/canonical-scan'
import type { RiskSignal } from '@/lib/types/intelligence'

function authorityState(input: { renounced?: boolean } | null | undefined): 'renounced' | 'active' | 'unknown' {
  if (input == null || input.renounced == null) return 'unknown'
  return input.renounced ? 'renounced' : 'active'
}

function normalizeSignals(signals: RiskSignal[] | null | undefined): SignalEntry[] {
  if (!Array.isArray(signals)) return []
  return signals.map((s) => ({
    code: s.code,
    severity: s.severity,
    message: s.message,
    impact: s.impact,
  }))
}

const CANONICAL_CACHE_TTL_SAFE_SEC = 300
const CANONICAL_CACHE_TTL_DEFAULT_SEC = 60

function canonicalCacheTtlSec(verdict: CanonicalScanResult['verdict']): number {
  return verdict === 'SAFE' ? CANONICAL_CACHE_TTL_SAFE_SEC : CANONICAL_CACHE_TTL_DEFAULT_SEC
}

function isValidCachedCanonicalScan(parsed: unknown, mint: string): parsed is CanonicalScanResult {
  if (!parsed || typeof parsed !== 'object') return false
  const p = parsed as Record<string, unknown>
  const liq = p.liquidity
  if (!liq || typeof liq !== 'object') return false
  return (
    p.mint === mint &&
    typeof p.riskScore === 'number' &&
    typeof p.verdict === 'string' &&
    typeof (liq as Record<string, unknown>).status === 'string' &&
    typeof (liq as Record<string, unknown>).reason === 'string'
  )
}

function liquidityFromLockResult(input: {
  status: 'burned' | 'locked' | 'unlocked' | 'unknown'
  burnedPct: number | null
  lockUntil: string | null
  reason?: string | null
  dexPairAddress?: string
}): CanonicalScanResult['liquidity'] {
  if (input.status === 'burned') {
    return {
      status: 'burned',
      burnPercentage: input.burnedPct ?? undefined,
      lockUntil: input.lockUntil ?? undefined,
      dexPairAddress: input.dexPairAddress,
      reason: input.reason ?? 'LP tokens burned.',
    }
  }
  if (input.status === 'locked') {
    return {
      status: 'locked',
      burnPercentage: input.burnedPct ?? undefined,
      lockUntil: input.lockUntil ?? undefined,
      dexPairAddress: input.dexPairAddress,
      reason: input.reason ?? 'LP tokens held in verified timelock.',
    }
  }
  if (input.status === 'unlocked') {
    return {
      status: 'unverified',
      burnPercentage: input.burnedPct ?? undefined,
      lockUntil: input.lockUntil ?? undefined,
      dexPairAddress: input.dexPairAddress,
      reason: input.reason ?? 'LP holder is not a verified burn/lock address.',
    }
  }
  return {
    status: 'unverified',
    burnPercentage: input.burnedPct ?? undefined,
    lockUntil: input.lockUntil ?? undefined,
    dexPairAddress: input.dexPairAddress,
    reason: input.reason ?? 'Could not verify LP holder state.',
  }
}

/**
 * Canonical Sentinel scan result for a mint.
 * This function is the single source of truth for cross-surface verdict/liquidity display.
 */
export async function canonicalScan(mint: string): Promise<CanonicalScanResult> {
  const cleanMint = String(mint ?? '').trim()
  if (cleanMint.length < 32) throw new Error('Valid Solana mint required')

  const generatedAt = new Date().toISOString()
  const cacheKey = `scan:canonical:v1:${cleanMint}`
  const fallbackReason = 'Canonical scan fallback: upstream intelligence unavailable.'

  const rawCached = await redis.get(cacheKey).catch(() => null)
  if (rawCached) {
    try {
      const parsed = JSON.parse(rawCached) as unknown
      if (isValidCachedCanonicalScan(parsed, cleanMint)) return parsed
    } catch {
      /* miss */
    }
  }

  const [dex, report] = await Promise.all([
    fetchTokenMetricsWithPair(cleanMint).catch(() => ({ pair: null as null })),
    buildTokenIntelligenceReport({
      mint: cleanMint,
      keyTier: 'v2',
      publicTier: 'PRO',
      scanId: randomUUID(),
      onlyTicker: false,
    }).catch(() => null),
  ])

  let liquidity: CanonicalScanResult['liquidity']
  const pairAddress = dex.pair?.pairAddress

  if (!pairAddress) {
    liquidity = {
      status: 'no_pair',
      reason: 'No DEX listing found',
    }
  } else {
    const lock = await detectLiquidityLock({
      dexId: dex.pair?.dexId,
      pairAddress,
    }).catch(() => ({ status: 'unknown' as const, burnedPct: null, lockUntil: null, reason: fallbackReason }))
    liquidity = liquidityFromLockResult({
      ...lock,
      dexPairAddress: pairAddress,
    })
  }

  const riskScore =
    typeof report?.riskScore === 'number' ? Math.max(0, Math.min(100, Math.round(report.riskScore))) : 50
  const verdictInfo = scoreToVerdict(riskScore)
  const signals = normalizeSignals(report?.riskSignals)
  const verdictReason =
    signals[0]?.message ??
    liquidity.reason ??
    'Deterministic Sentinel score based on authorities, distribution, liquidity, pair age, and insider heuristics.'

  const result: CanonicalScanResult = {
    mint: cleanMint,
    riskScore,
    verdict: verdictInfo.verdict,
    verdictReason,
    signals,
    liquidity,
    authorities: {
      mint: authorityState(report?.mintAuthority),
      freeze: authorityState(report?.freezeAuthority),
      update: authorityState(report?.updateAuthority),
    },
    topHolderConcentration: Number(report?.top10Concentration ?? 0),
    generatedAt,
    cacheKey,
  }

  const ttl = canonicalCacheTtlSec(result.verdict)
  await redis.setex(cacheKey, ttl, JSON.stringify(result)).catch(() => {})

  return result
}
