import { walletsSitemapResponse } from '@/lib/seo/sitemap-handlers'
import { SITEMAP_REVALIDATE_SECONDS } from '@/lib/seo/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = SITEMAP_REVALIDATE_SECONDS

export async function GET() {
  return walletsSitemapResponse(0)
}
