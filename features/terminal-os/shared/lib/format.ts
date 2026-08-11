/**
 * Number formatters for Terminal OS — no React (keep .ts).
 */

export function formatUsd(n: number, compact = false): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  if (compact && Math.abs(v) >= 1_000_000) {
    return `$${(v / 1_000_000).toFixed(1)}M`
  }
  if (compact && Math.abs(v) >= 1_000) {
    return `$${(v / 1_000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: v < 1 ? 6 : 2,
  }).format(v)
}

export function formatPct(n: number, digits = 2): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

export function timeAgo(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(ms / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
