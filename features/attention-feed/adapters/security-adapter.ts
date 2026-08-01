/**
 * Reshape Security Scanner / risk band outputs → AttentionItem.
 * Only danger/caution bands that deserve attention — never filler.
 */

import { scoreTokenFromMarket } from '@/features/terminal-os/shared/lib/score-from-market'
import type { TokenRow } from '@/features/terminal-os/shared/types'
import type { AttentionItem } from '../types'

export function adaptSecurityToAttention(tokens: TokenRow[]): AttentionItem[] {
  return tokens
    .map((t) => {
      const scan = scoreTokenFromMarket(t)
      if (scan.band !== 'danger' && scan.band !== 'caution') return null
      const urgency = scan.band === 'danger' ? 'now' : 'today'
      return {
        id: `security:${t.id}`,
        sourceEngine: 'security-scanner' as const,
        urgency: urgency as AttentionItem['urgency'],
        headline:
          scan.band === 'danger'
            ? `Security flag on $${t.symbol} — elevated risk`
            : `Caution on $${t.symbol} — review before sizing`,
        reality: `${t.name} scored ${scan.score}/100 (${scan.band}) from live market heuristics.`,
        analysis: scan.explanation,
        recommendation: {
          action: scan.band === 'danger' ? `Do not chase $${t.symbol} until risk clears` : `Scan $${t.symbol} before entry`,
          confidence: Math.round(scan.confidence),
        },
        evidence: [
          { id: 'e-score', kind: 'score', label: 'Token score', value: scan.score },
          { id: 'e-band', kind: 'text', label: 'Band', value: scan.band },
          { id: 'e-liq', kind: 'metric', label: 'Liquidity', value: Math.round(t.liquidityUsd) },
          ...scan.metrics.slice(0, 3).map((m, i) => ({
            id: `e-m-${i}`,
            kind: 'score' as const,
            label: m.label,
            value: m.value,
            detail: m.why,
          })),
        ],
        createdAt: new Date().toISOString(),
        rankScore: scan.band === 'danger' ? 95 : 70,
      } satisfies AttentionItem
    })
    .filter((x): x is AttentionItem => x != null)
    .slice(0, 4)
}
