const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const usdTight = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 6,
})

export function formatUsd(n: number, tight = false): string {
  if (!Number.isFinite(n)) return '—'
  return (tight || Math.abs(n) < 1 ? usdTight : usd).format(n)
}

export function formatUsdSigned(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = formatUsd(Math.abs(n))
  return n >= 0 ? `+${abs}` : `-${abs}`
}

export function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** Adaptive token amount precision (BONK-style large supplies → fewer decimals). */
export function formatAmount(amount: number, decimals = 9): string {
  if (!Number.isFinite(amount)) return '—'
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
  }
  if (amount >= 1_000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
  const places = Math.min(8, Math.max(2, decimals))
  return amount.toLocaleString(undefined, { maximumFractionDigits: places })
}

export function truncateWallet(addr: string): string {
  if (addr.length < 8) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function relativeAge(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'now'
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
