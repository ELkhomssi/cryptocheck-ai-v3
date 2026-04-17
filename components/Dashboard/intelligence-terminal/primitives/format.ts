/**
 * Display formatters for the Analysis Console. Null-safe: every
 * helper accepts `number | null | undefined` and returns an em-dash
 * placeholder for missing data so cards render predictably.
 */

const EM_DASH = '—'

/** Compact USD: $1.2M, $34.5K, $12.34, $0.000123 */
export function formatUsdCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return EM_DASH
  if (n === 0) return '$0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`
  // Sub-dollar: keep up to 6 significant digits.
  return `${sign}$${abs.toPrecision(3)}`
}

/** Percent delta with explicit sign: +3.21% / -1.45% */
export function formatPercent(
  n: number | null | undefined,
  opts: { signed?: boolean; digits?: number } = {}
): string {
  if (n == null || !Number.isFinite(n)) return EM_DASH
  const digits = opts.digits ?? 2
  const sign = opts.signed && n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

/** Short mint: Abcd…xyz9 */
export function shortMint(mint: string, lead = 6, tail = 6): string {
  if (!mint) return ''
  if (mint.length <= lead + tail + 1) return mint
  return `${mint.slice(0, lead)}…${mint.slice(-tail)}`
}

/** ISO date → "Mar 14, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return EM_DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return EM_DASH
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
