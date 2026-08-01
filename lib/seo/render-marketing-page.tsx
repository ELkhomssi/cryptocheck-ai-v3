import { notFound } from 'next/navigation'
import { MarketingFeaturePage } from '@/components/seo/MarketingFeaturePage'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { MARKETING_PAGES } from '@/lib/seo/marketing-pages'

export function getMarketingPage(path: string) {
  return MARKETING_PAGES.find((p) => p.path === path) ?? null
}

export function marketingMetadata(path: string) {
  const page = getMarketingPage(path)
  if (!page) return {}
  return buildPageMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    keywords: page.keywords,
  })
}

export function RenderMarketingPage({ path }: { path: string }) {
  const page = getMarketingPage(path)
  if (!page) notFound()
  return (
    <MarketingFeaturePage
      title={page.headline}
      description={page.support}
      primaryCta={page.primaryCta}
      secondaryCta={page.secondaryCta}
    />
  )
}
