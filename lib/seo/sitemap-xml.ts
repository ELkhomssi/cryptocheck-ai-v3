import { absoluteUrl, getSiteUrl } from '@/lib/seo/site'
import type { SitemapEntry } from '@/lib/seo/sitemap-sources'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function renderUrlSet(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const loc = absoluteUrl(e.locPath)
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${escapeXml(e.lastmod.slice(0, 10))}</lastmod>`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n')
}

export type SitemapIndexItem = {
  locPath: string
  lastmod?: string
}

export function renderSitemapIndex(items: SitemapIndexItem[]): string {
  const body = items
    .map((item) => {
      const loc = item.locPath.startsWith('http') ? item.locPath : `${getSiteUrl()}${item.locPath}`
      const lastmod = item.lastmod
        ? `\n    <lastmod>${escapeXml(item.lastmod.slice(0, 10))}</lastmod>`
        : ''
      return `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n  </sitemap>`
    })
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</sitemapindex>',
    '',
  ].join('\n')
}

export function sitemapResponse(xml: string, revalidateSeconds: number): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': `public, s-maxage=${revalidateSeconds}, stale-while-revalidate=${revalidateSeconds * 2}`,
    },
  })
}
