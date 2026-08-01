import {
  fetchIndexedReportEntries,
  fetchIndexedTokenEntries,
  fetchIndexedWalletEntries,
  type SitemapEntry,
} from '@/lib/seo/sitemap-sources'
import { renderUrlSet, sitemapResponse } from '@/lib/seo/sitemap-xml'
import { SITEMAP_REVALIDATE_SECONDS, SITEMAP_URL_LIMIT } from '@/lib/seo/site'

async function pageEntries(
  fetcher: (opts: { offset: number; limit: number }) => Promise<SitemapEntry[]>,
  page: number,
): Promise<Response> {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0
  const offset = safePage * SITEMAP_URL_LIMIT
  const entries = await fetcher({ offset, limit: SITEMAP_URL_LIMIT })
  return sitemapResponse(renderUrlSet(entries), SITEMAP_REVALIDATE_SECONDS)
}

export function tokensSitemapResponse(page = 0) {
  return pageEntries(fetchIndexedTokenEntries, page)
}

export function walletsSitemapResponse(page = 0) {
  return pageEntries(fetchIndexedWalletEntries, page)
}

export function reportsSitemapResponse(page = 0) {
  return pageEntries(fetchIndexedReportEntries, page)
}
