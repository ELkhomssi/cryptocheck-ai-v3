export type StaticSitemapRoute = {
  path: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

/**
 * Public indexable static routes for /sitemap-static.xml.
 * Paths must resolve to real App Router pages (or intentional 301s).
 */
export const STATIC_SITEMAP_ROUTES: StaticSitemapRoute[] = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/terminalOS', changefreq: 'daily', priority: 0.95 },
  { path: '/execution', changefreq: 'weekly', priority: 0.9 },
  { path: '/discovery', changefreq: 'weekly', priority: 0.9 },
  { path: '/scanner', changefreq: 'weekly', priority: 0.9 },
  { path: '/market-intel', changefreq: 'weekly', priority: 0.9 },
  { path: '/portfolio', changefreq: 'weekly', priority: 0.85 },
  { path: '/ai-coach', changefreq: 'weekly', priority: 0.85 },
  { path: '/trade-like-me', changefreq: 'weekly', priority: 0.85 },
  { path: '/security', changefreq: 'monthly', priority: 0.85 },
  { path: '/pricing', changefreq: 'weekly', priority: 0.9 },
  { path: '/about', changefreq: 'monthly', priority: 0.7 },
  { path: '/contact', changefreq: 'monthly', priority: 0.7 },
  { path: '/docs', changefreq: 'weekly', priority: 0.8 },
  { path: '/blog', changefreq: 'daily', priority: 0.85 },
  { path: '/status', changefreq: 'daily', priority: 0.5 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3 },
  { path: '/launchLab', changefreq: 'weekly', priority: 0.75 },
]
