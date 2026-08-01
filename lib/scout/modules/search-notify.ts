import 'server-only'

import { absoluteUrl } from '@/lib/seo/site'

/**
 * Notify search engines after Scout publish.
 * Uses IndexNow when INDEXNOW_KEY is set; always pings Google sitemap URL (best-effort).
 * Failures are logged — never block publish.
 */
export async function notifySearchEnginesOfUrl(path: string): Promise<{
  indexNow: boolean
  sitemapPing: boolean
}> {
  const url = path.startsWith('http') ? path : absoluteUrl(path)
  let indexNow = false
  let sitemapPing = false

  const indexKey = process.env.INDEXNOW_KEY?.trim()
  if (indexKey) {
    try {
      const host = new URL(url).host
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: indexKey,
          keyLocation: `https://${host}/${indexKey}.txt`,
          urlList: [url],
        }),
      })
      indexNow = res.ok || res.status === 202
    } catch (err) {
      console.error('[scout] IndexNow notify failed', err)
    }
  }

  try {
    const sitemap = absoluteUrl('/sitemap.xml')
    const res = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
      { method: 'GET' },
    )
    // Google deprecated ping responses; treat network success as best-effort.
    sitemapPing = res.status < 500
  } catch (err) {
    console.error('[scout] sitemap ping failed', err)
  }

  return { indexNow, sitemapPing }
}
