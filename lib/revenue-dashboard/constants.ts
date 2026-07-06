/** Base path for the new Revenue Dashboard (scan → safe swap). Separate from intelligence-terminal. */
export const REVENUE_DASHBOARD_BASE_PATH = '/dashboard/revenue'

export const REVENUE_NAV = {
  overview: REVENUE_DASHBOARD_BASE_PATH,
  terminal: `${REVENUE_DASHBOARD_BASE_PATH}/terminal`,
  portfolio: `${REVENUE_DASHBOARD_BASE_PATH}/portfolio`,
  alerts: `${REVENUE_DASHBOARD_BASE_PATH}/alerts`,
  badge: `${REVENUE_DASHBOARD_BASE_PATH}/badge`,
  revenue: `${REVENUE_DASHBOARD_BASE_PATH}/fees`,
  api: '/dashboard/api-keys',
} as const

/** Jupiter platformFeeBps — transparent default (0.5%). */
export const DEFAULT_PLATFORM_FEE_BPS = 50

export const DEFAULT_SLIPPAGE_BPS = 50
export const MAX_SLIPPAGE_BPS = 300

export const HIGH_PRICE_IMPACT_WARN_PCT = 2

export const COMPLIANCE_DISCLAIMER =
  'Not financial advice · DYOR. CryptoCheck does not custody funds or keys.'

export const FEE_DISCLOSURE_PATH = '/legal/fees'
export const TERMS_PATH = '/legal/terms'

export function terminalDeepLink(mint?: string): string {
  if (!mint?.trim()) return REVENUE_NAV.terminal
  return `${REVENUE_NAV.terminal}?mint=${encodeURIComponent(mint.trim())}`
}

/** Deep-link to sell a held token into SOL/USDC (exit to safety). */
export function terminalExitDeepLink(mint: string): string {
  return `${REVENUE_NAV.terminal}?exitMint=${encodeURIComponent(mint.trim())}`
}

/** Display price for verified badge (client-safe). Server uses VERIFIED_BADGE_PRICE_USD env. */
export const VERIFIED_BADGE_PRICE_USD = Number(
  process.env.NEXT_PUBLIC_VERIFIED_BADGE_PRICE_USD ?? process.env.VERIFIED_BADGE_PRICE_USD ?? 49,
)

export function badgeEmbedSnippet(mint: string, origin?: string): string {
  const base = (origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.cryptocheckai.com').replace(
    /\/$/,
    '',
  )
  const short = mint.slice(0, 8)
  return `<div id="ccai-badge-${short}"></div>
<script async src="${base}/ccai-badge.js" data-mint="${mint}" data-target="ccai-badge-${short}"></script>`
}
