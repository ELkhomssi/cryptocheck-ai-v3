import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingFeaturePage } from '@/components/seo/MarketingFeaturePage'
import { marketingMetadata, getMarketingPage } from '@/lib/seo/render-marketing-page'

export const metadata: Metadata = marketingMetadata('/scanner')

type Props = { searchParams?: { mint?: string } }

export default function ScannerPage({ searchParams }: Props) {
  const page = getMarketingPage('/scanner')!
  const mint = typeof searchParams?.mint === 'string' ? searchParams.mint.trim() : ''
  const href = mint ? `/app?mint=${encodeURIComponent(mint)}` : '/app'

  return (
    <MarketingFeaturePage
      title={page.headline}
      description={
        mint
          ? `Ready to scan mint ${mint.slice(0, 8)}… — CryptoCheckAI will open the live scanner with this address.`
          : page.support
      }
      primaryCta={{ href, label: mint ? 'Scan this mint' : page.primaryCta.label }}
      secondaryCta={page.secondaryCta}
    >
      {mint ? (
        <p className="break-all text-xs text-slate-500">
          Mint: {mint} ·{' '}
          <Link href={`/token/${mint}`} className="text-[#c8ff00] underline-offset-2 hover:underline">
            Public token page
          </Link>
        </p>
      ) : null}
    </MarketingFeaturePage>
  )
}
