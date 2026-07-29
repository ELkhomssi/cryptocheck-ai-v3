import type { TokenRow } from '@/features/terminal-os/shared/types'

/** Strip $ prefix / whitespace for ticker equality (DexScreener often uses `$WIF`). */
export function normalizeTokenSymbol(symbol: string): string {
  return symbol.trim().replace(/^\$+/, '').toLowerCase()
}

/**
 * Inflated-liquidity / dead-volume pairs are common DexScreener search noise.
 * Prefer real markets over fake depth.
 */
export function isSuspiciousMarketRow(t: TokenRow): boolean {
  if (t.volume24hUsd < 100 && t.liquidityUsd > 1_000_000) return true
  if (t.volume24hUsd < 10 && t.liquidityUsd > 100_000) return true
  if (t.priceUsd <= 0) return true
  return false
}

function qualityScore(t: TokenRow): number {
  // Volume dominates; liquidity is a tie-breaker via log scale
  return t.volume24hUsd * 10 + Math.log10(Math.max(t.liquidityUsd, 1)) * 1_000
}

const PREFERRED_CHAINS = new Set(['solana', 'ethereum', 'bnb', 'base', 'arbitrum'])

/**
 * Rank search candidates for a scan query.
 * Prefer exact symbol → exact address → name contains, then highest quality.
 * Never picks an unrelated top-list token outside `candidates`.
 */
export function selectBestTokenMatch(query: string, candidates: TokenRow[]): TokenRow | null {
  if (!candidates.length) return null
  const needle = normalizeTokenSymbol(query)
  if (!needle) return null

  const usable = candidates.filter((t) => !isSuspiciousMarketRow(t))
  const pool = usable.length ? usable : candidates

  const exactSymbol = pool.filter((t) => normalizeTokenSymbol(t.symbol) === needle)
  if (exactSymbol.length) {
    return rankPool(exactSymbol)[0]!
  }
  const exactAddr = pool.find(
    (t) =>
      t.id.toLowerCase() === query.trim().toLowerCase() ||
      (t.pairAddress && t.pairAddress.toLowerCase() === query.trim().toLowerCase()),
  )
  if (exactAddr) return exactAddr
  const nameHit = pool.filter((t) => t.name.toLowerCase().includes(needle))
  if (nameHit.length) {
    return rankPool(nameHit)[0]!
  }
  // Last resort among search results for this query — still query-scoped, not top-list
  return rankPool(pool)[0]!
}

function rankPool(rows: TokenRow[]): TokenRow[] {
  return [...rows].sort((a, b) => {
    const prefA = PREFERRED_CHAINS.has(a.chain) ? 1 : 0
    const prefB = PREFERRED_CHAINS.has(b.chain) ? 1 : 0
    if (prefA !== prefB) return prefB - prefA
    return qualityScore(b) - qualityScore(a)
  })
}
