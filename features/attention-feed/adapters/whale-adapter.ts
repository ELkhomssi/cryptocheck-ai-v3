/**
 * Reshape whale / smart-money feed → AttentionItem.
 * Skips sample rows — Simple Mode never surfaces illustrative placeholders as conclusions.
 */

import type { WhaleMovement } from '@/features/terminal-os/shared/types'
import type { AttentionItem } from '../types'

export function adaptWhalesToAttention(whales: WhaleMovement[]): AttentionItem[] {
  return whales
    .filter((w) => !w.sample && w.aiConfidence >= 55)
    .slice(0, 8)
    .map((w) => {
      const usd =
        w.usdValue >= 1_000_000
          ? `$${(w.usdValue / 1_000_000).toFixed(2)}M`
          : w.usdValue >= 1_000
            ? `$${(w.usdValue / 1_000).toFixed(1)}K`
            : `$${Math.round(w.usdValue)}`
      const urgency = w.smartMoney && w.aiConfidence >= 75 ? 'now' : w.aiConfidence >= 65 ? 'today' : 'fyi'
      return {
        id: `whale:${w.id}`,
        sourceEngine: 'wallet-intelligence' as const,
        urgency,
        headline: `${w.smartMoney ? 'Smart money' : 'Whale'} ${w.action} ${w.assetSymbol} · ${usd}`,
        reality: `${w.walletTruncated} on ${w.chain} · ${w.action} ${w.assetSymbol} (${usd}) — classified ${w.classification}.`,
        analysis:
          w.aiReasoning ||
          w.classificationWhy ||
          'Wallet Intelligence classification (fact) — Decision Engine owns act synthesis.',
        evidence: [
          { id: 'e-conf', kind: 'score', label: 'AI confidence', value: Math.round(w.aiConfidence) },
          { id: 'e-sm', kind: 'score', label: 'Smart-money score', value: Math.round(w.smartMoneyScore) },
          { id: 'e-impact', kind: 'score', label: 'Impact', value: Math.round(w.impactScore) },
          { id: 'e-why', kind: 'text', label: 'Classification', detail: w.classificationWhy },
        ],
        createdAt: w.occurredAt,
        rankScore: Math.round(w.aiConfidence) + (w.smartMoney ? 15 : 0) + Math.round(w.impactScore / 5),
      } satisfies AttentionItem
    })
}
