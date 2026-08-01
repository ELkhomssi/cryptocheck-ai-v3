/**
 * Reshape Security Scanner-style risk flags → AttentionItem (facts / thresholds).
 * Band from liquidity + volatility heuristics — not an act recommendation.
 */

import type { TokenRow } from '@/features/terminal-os/shared/types'
import type { AttentionItem } from '../types'

function securityFlag(t: TokenRow): 'danger' | 'caution' | null {
  if (t.liquidityUsd < 25_000 || Math.abs(t.change24hPct) > 60) return 'danger'
  if (t.liquidityUsd < 80_000 || Math.abs(t.change24hPct) > 35) return 'caution'
  return null
}

export function adaptSecurityToAttention(tokens: TokenRow[]): AttentionItem[] {
  const out: AttentionItem[] = []
  for (const t of tokens) {
    const band = securityFlag(t)
    if (!band) continue
    const urgency: AttentionItem['urgency'] = band === 'danger' ? 'now' : 'today'
    out.push({
      id: `security:${t.id}`,
      sourceEngine: 'security-scanner',
      urgency,
      headline:
        band === 'danger'
          ? `Security flag on $${t.symbol} — elevated risk heuristics`
          : `Caution on $${t.symbol} — thin liquidity or high volatility`,
      reality: `${t.name}: liq $${Math.round(t.liquidityUsd).toLocaleString()} · 24h ${t.change24hPct.toFixed(1)}% (${band}).`,
      analysis: 'Security Layer fact/threshold — Decision Engine synthesizes act confidence separately.',
      evidence: [
        { id: 'e-band', kind: 'text', label: 'Band', value: band },
        { id: 'e-liq', kind: 'metric', label: 'Liquidity', value: Math.round(t.liquidityUsd) },
        { id: 'e-chg', kind: 'metric', label: '24h change', value: t.change24hPct },
      ],
      createdAt: new Date().toISOString(),
      rankScore: band === 'danger' ? 95 : 70,
    })
    if (out.length >= 4) break
  }
  return out
}
