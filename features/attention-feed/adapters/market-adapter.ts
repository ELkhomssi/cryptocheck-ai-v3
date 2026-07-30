/**
 * Reshape market top tokens → AttentionItem (movers that deserve a decision, not a ticker).
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
          ? 'Market Intelligence flags elevated momentum — confirm security and liquidity before chasing.'
          : 'Sharp drawdown may be opportunity or risk — check Security Layer and whale flow before buying the dip.',
        recommendation: {
          action: up ? `Scan $${t.symbol} before entry` : `Assess $${t.symbol} risk before averaging`,
          confidence: Math.min(90, 40 + Math.round(Math.abs(t.change24hPct))),
        },
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
