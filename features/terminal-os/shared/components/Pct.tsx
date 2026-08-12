'use client'

import { formatPct } from '../lib/format'

export function Pct({ value }: { value: number }) {
  const cls = value >= 0 ? 'tos-pos' : 'tos-neg'
  return <span className={`tos-num ${cls}`}>{formatPct(value)}</span>
}
