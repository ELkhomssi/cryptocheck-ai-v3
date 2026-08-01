import { walletsSitemapResponse } from '@/lib/seo/sitemap-handlers'
import { SITEMAP_REVALIDATE_SECONDS } from '@/lib/seo/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = SITEMAP_REVALIDATE_SECONDS

type Ctx = { params: { page: string } }

export async function GET(_req: Request, ctx: Ctx) {
  const raw = ctx.params.page.replace(/\.xml$/i, '')
  const page = Number.parseInt(raw, 10)
  if (!Number.isFinite(page) || page < 0) {
    return new Response('Not Found', { status: 404 })
  }
  return walletsSitemapResponse(page)
}
