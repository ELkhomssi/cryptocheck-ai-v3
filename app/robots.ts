import type { MetadataRoute } from 'next'

/** Production sitemap URL for Google Search Console (must be absolute). */
const PRODUCTION_SITEMAP = 'https://www.cryptocheckai.com/sitemap.xml'

export default function robots(): MetadataRoute.Robots {
  const allowAiScrapers = process.env.AI_SCRAPER_ALLOW === '1'

  const rules: MetadataRoute.Robots['rules'] = [
    {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/private/', '/auth/', '/operator/', '/dashboard/'],
    },
  ]

  const aiAgents = [
    'GPTBot',
    'ClaudeBot',
    'Bytespider',
    'CCBot',
    'AmazonBot',
    'Diffbot',
    'PetalBot',
    'PerplexityBot',
    'OAI-SearchBot',
    'Meta-ExternalAgent',
  ]

  for (const userAgent of aiAgents) {
    rules.push(allowAiScrapers ? { userAgent, allow: '/' } : { userAgent, disallow: '/' })
  }

  return {
    rules,
    // Always advertise the production sitemap — never localhost from preview env bleed.
    sitemap: PRODUCTION_SITEMAP,
    host: 'www.cryptocheckai.com',
  }
}
