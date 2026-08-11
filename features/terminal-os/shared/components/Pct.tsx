'use client'

import { formatPct } from '../lib/format'

export function Pct({ value }: { value: number }) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const cls = n >= 0 ? 'tos-pos' : 'tos-neg'
  return <span className={`tos-num ${cls}`}>{formatPct(n)}</span>
}
