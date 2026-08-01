import type { MetadataRoute } from 'next'
import { STATIC_SITEMAP_ROUTES } from '@/lib/seo/static-routes'
import {
  fetchIndexedReportEntries,
  fetchIndexedTokenEntries,
  fetchIndexedWalletEntries,
} from '@/lib/seo/sitemap-sources'
import { DEFAULT_SITE_URL, SITEMAP_URL_LIMIT, getSiteUrl } from '@/lib/seo/site'

/**
 * Official Next.js App Router Metadata sitemap.
 * Served at /sitemap.xml — do NOT use app/sitemap.xml/route.ts (conflicts / 404s).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl() || DEFAULT_SITE_URL
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map((route) => ({
    url: route.path === '/' ? `${base}/` : `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.changefreq,
    priority: route.priority,
  }))

  // Dynamic DB entries — fail open to static-only if Supabase is unavailable.
  let tokens: MetadataRoute.Sitemap = []
  let wallets: MetadataRoute.Sitemap = []
  let reports: MetadataRoute.Sitemap = []

  try {
    const [tokenRows, walletRows, reportRows] = await Promise.all([
      fetchIndexedTokenEntries({ limit: SITEMAP_URL_LIMIT }),
      fetchIndexedWalletEntries({ limit: Math.min(10_000, SITEMAP_URL_LIMIT) }),
      fetchIndexedReportEntries({ limit: Math.min(10_000, SITEMAP_URL_LIMIT) }),
    ])

    tokens = tokenRows.map((e) => ({
      url: `${base}${e.locPath}`,
      lastModified: new Date(e.lastmod),
      changeFrequency: e.changefreq,
      priority: e.priority,
    }))
    wallets = walletRows.map((e) => ({
      url: `${base}${e.locPath}`,
      lastModified: new Date(e.lastmod),
      changeFrequency: e.changefreq,
      priority: e.priority,
    }))
    reports = reportRows.map((e) => ({
      url: `${base}${e.locPath}`,
      lastModified: new Date(e.lastmod),
      changeFrequency: e.changefreq,
      priority: e.priority,
    }))
  } catch (err) {
    console.error('[seo] sitemap.ts dynamic fetch failed', err)
  }

  // Stay under Google’s 50k URL / sitemap limit with headroom for static routes.
  const dynamicBudget = Math.max(0, SITEMAP_URL_LIMIT - staticEntries.length)
  const combinedDynamic = [...tokens, ...wallets, ...reports].slice(0, dynamicBudget)

  return [...staticEntries, ...combinedDynamic]
}
