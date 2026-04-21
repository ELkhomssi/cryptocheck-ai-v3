/**
 * UI-only labels — marketing "PRO MAX"; DB `ENTERPRISE` is the full-access master tier.
 */
export function tradingOsTierBadge(tier: string | null | undefined): string {
  const t = String(tier ?? '').toUpperCase()
  if (t === 'ENTERPRISE' || t === 'INSTITUTIONAL') return '◆ PRO MAX · Full stack'
  if (t === 'PRO_MAX_ELITE') return '◆ PRO MAX ELITE'
  if (t === 'PRO_MAX_DEEP' || t === 'PRO') return '◆ PRO MAX DEEP'
  if (t === 'FREE') return 'FREE'
  return '◆ PRO MAX DEEP'
}
