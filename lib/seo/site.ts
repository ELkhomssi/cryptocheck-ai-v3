/**
 * Production SEO site constants — keep in sync with Vercel primary domain.
 */

export const SITE_NAME = 'CryptoCheckAI'
export const SITE_LEGAL_NAME = 'CryptoCheck AI'
export const SITE_DOMAIN = 'www.cryptocheckai.com'
export const DEFAULT_SITE_URL = `https://${SITE_DOMAIN}`

/** Google sitemap hard limits (leave headroom). */
export const SITEMAP_URL_LIMIT = 45_000
export const SITEMAP_REVALIDATE_SECONDS = 3600

export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    DEFAULT_SITE_URL
  return raw.replace(/\/+$/, '')
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getSiteUrl()}${path}`
}

export const DEFAULT_OG_IMAGE_PATH = '/logo.jpg'

export const HOME_KEYWORDS = [
  'crypto AI',
  'solana scanner',
  'rug checker',
  'wallet analysis',
  'smart money',
  'AI trading',
  'crypto security',
  'trading terminal',
  'AI coach',
  'token scanner',
] as const
