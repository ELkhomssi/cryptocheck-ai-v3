import {
  countIndexedReportsApprox,
  countIndexedTokensApprox,
  countIndexedWalletsApprox,
  sitemapPageCount,
} from '@/lib/seo/sitemap-sources'
import { renderSitemapIndex, sitemapResponse } from '@/lib/seo/sitemap-xml'
import { SITEMAP_REVALIDATE_SECONDS, SITEMAP_URL_LIMIT } from '@/lib/seo/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = SITEMAP_REVALIDATE_SECONDS

/**
 * Sitemap index — Google discovers child sitemaps here.
 * Child files refresh from DB automatically (new tokens/wallets/reports).
 */
export async function GET() {
  const now = new Date().toISOString()
  const [tokenCount, walletCount, reportCount] = await Promise.all([
    countIndexedTokensApprox(),
    countIndexedWalletsApprox(),
    countIndexedReportsApprox(),
  ])

  const items: { locPath: string; lastmod: string }[] = [
    { locPath: '/sitemap-static.xml', lastmod: now },
  ]

  const tokenPages = sitemapPageCount(tokenCount)
  if (tokenPages <= 1) {
    items.push({ locPath: '/sitemap-tokens.xml', lastmod: now })
  } else {
    for (let page = 0; page < tokenPages; page++) {
      items.push({ locPath: `/sitemap-tokens/${page}`, lastmod: now })
    }
  }

  const walletPages = sitemapPageCount(walletCount)
  if (walletPages <= 1) {
    items.push({ locPath: '/sitemap-wallets.xml', lastmod: now })
  } else {
    for (let page = 0; page < walletPages; page++) {
      items.push({ locPath: `/sitemap-wallets/${page}`, lastmod: now })
    }
  }

  const reportPages = sitemapPageCount(reportCount)
  if (reportPages <= 1) {
    items.push({ locPath: '/sitemap-reports.xml', lastmod: now })
  } else {
    for (let page = 0; page < reportPages; page++) {
      items.push({ locPath: `/sitemap-reports/${page}`, lastmod: now })
    }
  }

  // Keep Google under file/entry limits even if counts are noisy.
  void SITEMAP_URL_LIMIT

  return sitemapResponse(renderSitemapIndex(items), SITEMAP_REVALIDATE_SECONDS)
}
