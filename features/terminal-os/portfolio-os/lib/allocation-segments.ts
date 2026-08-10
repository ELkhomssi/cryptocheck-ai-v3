/**
 * Portfolio allocation math — pure, testable.
 * Kernel: Holding.allocationPct / valueUsd from Portfolio Intelligence only.
 */

import type { Holding } from '@/types/portfolio-desk'

export const DONUT_COLORS = [
  '#00E5FF',
  '#00FFA3',
  '#FFB800',
  '#3D8BFD',
  '#A78BFA',
  '#F472B6',
  '#64748B',
] as const

export function allocationSegments(
  holdings: Pick<Holding, 'mint' | 'symbol' | 'allocationPct' | 'valueUsd'>[],
  max = 6,
): { mint: string; symbol: string; pct: number; valueUsd: number }[] {
  const sorted = [...holdings].filter((h) => h.valueUsd > 0).sort((a, b) => b.valueUsd - a.valueUsd)
  const top = sorted.slice(0, max)
  const otherPct = Math.max(0, 100 - top.reduce((s, h) => s + h.allocationPct, 0))
  const segs = top.map((h) => ({
    mint: h.mint,
    symbol: h.symbol,
    pct: h.allocationPct,
    valueUsd: h.valueUsd,
  }))
  if (otherPct >= 0.5 && sorted.length > max) {
    segs.push({
      mint: '_other',
      symbol: 'Other',
      pct: otherPct,
      valueUsd: sorted.slice(max).reduce((s, h) => s + h.valueUsd, 0),
    })
  }
  return segs
}
