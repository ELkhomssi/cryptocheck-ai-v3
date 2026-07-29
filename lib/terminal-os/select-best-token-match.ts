import type { TokenRow } from '@/features/terminal-os/shared/types'

/** Strip $ prefix for ticker equality (DexScreener often uses `$WIF`). */
export function normalizeTokenSymbol(symbol: string): string {
  return symbol.trim().replace(/^\$+/, '').toLowerCase()
}

export function isSuspiciousMarketRow(t: TokenRow): boolean {
  if (t.volume24hUsd < 100 && t.liquidityUsd > 1_000_000) return true
  if (t.volume24hUsd < 10 && t.liquidityUsd > 100_000) return true
  if (t.priceUsd <= 0) return true
  return false
}

function qualityScore(t: TokenRow): number {
  return t.volume24hUsd * 10 + Math.log10(Math.max(t.liquidityUsd, 1)) * 1_000
}

const PREFERRED = new Set(['solana', 'ethereum', 'bnb', 'base', 'arbitrum'])

export function selectBestTokenMatch(query: string, candidates: TokenRow[]): TokenRow | null {
  if (!candidates.length) return null
  const needle = normalizeTokenSymbol(query)
  if (!needle) return null
  const usable = candidates.filter((t) => !isSuspiciousMarketRow(t))
  const pool = usable.length ? usable : candidates
  const exact = pool.filter((t) => normalizeTokenSymbol(t.symbol) === needle)
  if (exact.length) {
    return [...exact].sort((a, b) => {
      const pa = PREFERRED.has(a.chain) ? 1 : 0
      const pb = PREFERRED.has(b.chain) ? 1 : 0
      if (pa !== pb) return pb - pa
      return qualityScore(b) - qualityScore(a)
    })[0]!
  }
  const addr = pool.find(
    (t) =>
      t.id.toLowerCase() === query.trim().toLowerCase() ||
      (t.pairAddress && t.pairAddress.toLowerCase() === query.trim().toLowerCase()),
  )
  if (addr) return addr
  const nameHit = pool.filter((t) => t.name.toLowerCase().includes(needle))
  if (nameHit.length) {
    return [...nameHit].sort((a, b) => qualityScore(b) - qualityScore(a))[0]!
  }
  return [...pool].sort((a, b) => qualityScore(b) - qualityScore(a))[0]!
}
