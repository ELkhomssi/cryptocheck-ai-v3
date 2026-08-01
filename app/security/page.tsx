import type { Metadata } from 'next'
import { marketingMetadata, RenderMarketingPage } from '@/lib/seo/render-marketing-page'

export const metadata: Metadata = marketingMetadata('/security')

export default function Page() {
  return <RenderMarketingPage path="/security" />
}
