/**
 * Reshape market top tokens → AttentionItem (movers that deserve a look — facts only).
 * Does not invent act recommendations; Decision Engine owns BUY/SELL/WAIT.
 */

import type { TokenRow } from '@/features/terminal-os/shared/types'
import type { AttentionItem } from '../types'

export function adaptMarketToAttention(tokens: TokenRow[]): AttentionItem[] {
  return tokens
    .filter((t) => Math.abs(t.change24hPct) >= 8 && t.liquidityUsd >= 50_000)
    .slice(0, 5)
    .map((t) => {
      const up = t.change24hPct >= 0
      const pct = `${up ? '+' : ''}${t.change24hPct.toFixed(1)}%`
      const urgency = Math.abs(t.change24hPct) >= 25 ? 'now' : Math.abs(t.change24hPct) >= 12 ? 'today' : 'fyi'
      return {
        id: `market:${t.id}`,
        sourceEngine: 'market-intelligence' as const,
        urgency,
        headline: `$${t.symbol} ${up ? 'surging' : 'selling off'} ${pct} (24h)`,
        reality: `${t.name} on ${t.chain} moved ${pct} with $${Math.round(t.volume24hUsd).toLocaleString()} volume and $${Math.round(t.liquidityUsd).toLocaleString()} liquidity.`,
        analysis: up
          ? 'Market Intelligence fact: elevated 24h momentum. Opinion deferred to Decision Engine.'
          : 'Market Intelligence fact: sharp 24h drawdown. Opinion deferred to Decision Engine.',
        // No recommendation — Layer 1 facts only; Discovery/Execution read Decision items
        evidence: [
          { id: 'e-px', kind: 'metric', label: 'Price', value: t.priceUsd },
          { id: 'e-chg', kind: 'metric', label: '24h change', value: pct },
          { id: 'e-vol', kind: 'metric', label: 'Volume 24h', value: Math.round(t.volume24hUsd) },
          { id: 'e-liq', kind: 'metric', label: 'Liquidity', value: Math.round(t.liquidityUsd) },
        ],
        createdAt: new Date().toISOString(),
        rankScore: Math.min(100, Math.round(Math.abs(t.change24hPct) * 2)),
      } satisfies AttentionItem
    })
}
