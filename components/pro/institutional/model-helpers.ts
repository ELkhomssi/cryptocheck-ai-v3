import type { ReasoningObject } from '@cryptocheck/types'

export function extractTopHolderPct(r: ReasoningObject): number {
  const line = r.evidence.find((e) => e.id === 'ev_concentration')
  const m = line?.detail.match(/(\d+\.?\d*)%/)
  if (m) return Math.min(100, Math.max(0, parseFloat(m[1])))
  return 12
}
