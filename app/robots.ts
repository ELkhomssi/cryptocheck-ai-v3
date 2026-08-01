import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  const site = getSiteUrl()
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
    rules.push(
      allowAiScrapers
        ? { userAgent, allow: '/' }
        : { userAgent, disallow: '/' },
    )
  }

  return {
    rules,
    sitemap: `${site}/sitemap.xml`,
    host: site.replace(/^https?:\/\//, ''),
  }
}
