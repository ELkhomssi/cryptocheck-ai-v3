import { STATIC_SITEMAP_ROUTES } from '@/lib/seo/static-routes'
import { renderUrlSet, sitemapResponse } from '@/lib/seo/sitemap-xml'
import { SITEMAP_REVALIDATE_SECONDS } from '@/lib/seo/site'
import type { SitemapEntry } from '@/lib/seo/sitemap-sources'

export const runtime = 'nodejs'
export const revalidate = SITEMAP_REVALIDATE_SECONDS

export async function GET() {
  const lastmod = new Date().toISOString()
  const entries: SitemapEntry[] = STATIC_SITEMAP_ROUTES.map((r) => ({
    locPath: r.path,
    lastmod,
    changefreq: r.changefreq,
    priority: r.priority,
  }))
  return sitemapResponse(renderUrlSet(entries), SITEMAP_REVALIDATE_SECONDS)
}
