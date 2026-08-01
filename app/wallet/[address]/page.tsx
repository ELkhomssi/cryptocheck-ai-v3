import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLdScript } from '@/components/seo/JsonLd'
import { walletJsonLd } from '@/lib/seo/json-ld'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublicWalletPageData } from '@/lib/seo/page-data'

type Props = { params: { address: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicWalletPageData(params.address)
  if (!data) {
    return buildPageMetadata({
      title: 'Wallet not found — CryptoCheckAI',
      description: 'This Solana wallet is not in the CryptoCheckAI indexed smart-money set.',
      path: `/wallet/${params.address}`,
      noIndex: true,
    })
  }
  const short = `${data.address.slice(0, 4)}…${data.address.slice(-4)}`
  const title = data.label
    ? `${data.label} (${short}) Wallet Analysis — CryptoCheckAI`
    : `Wallet ${short} Analysis — CryptoCheckAI`
  const description = [
    'CryptoCheckAI wallet analysis for',
    data.label ?? short,
    data.tier ? `· tier ${data.tier}` : null,
    data.winRatePct != null ? `· win rate ${data.winRatePct}%` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return buildPageMetadata({
    title,
    description,
    path: `/wallet/${data.address}`,
    keywords: ['wallet analysis', 'smart money', 'solana wallet', data.tier ?? 'wallet', 'CryptoCheckAI'],
    type: 'profile',
  })
}

export default async function WalletPublicPage({ params }: Props) {
  const data = await getPublicWalletPageData(params.address)
  if (!data) notFound()

  const short = `${data.address.slice(0, 4)}…${data.address.slice(-4)}`
  const description = [
    'Indexed CryptoCheckAI wallet profile for',
    data.label ?? short,
    data.tier ? `(${data.tier})` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <main className="min-h-screen bg-[#050510] px-6 py-12 text-slate-200 md:px-10">
      <JsonLdScript
        data={walletJsonLd({
          address: data.address,
          label: data.label,
          description,
          tier: data.tier,
        })}
      />
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">
          CryptoCheckAI · Wallet
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">
          {data.label ?? `Wallet ${short}`}
        </h1>
        <p className="mt-2 break-all text-xs text-slate-500">{data.address}</p>
        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Tier</dt>
            <dd className="mt-1 font-semibold text-slate-100">{data.tier ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Win rate</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {data.winRatePct != null ? `${data.winRatePct}%` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Hist. PnL</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {data.historicalPnlUsd != null
                ? `$${Math.round(data.historicalPnlUsd).toLocaleString('en-US')}`
                : '—'}
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/trade-like-me"
            className="inline-flex rounded-lg border border-[#c8ff00]/35 bg-[#c8ff00]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c8ff00]"
          >
            Trade Like Me
          </Link>
          <Link
            href="/terminalOS"
            className="inline-flex rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-300"
          >
            Open Terminal OS
          </Link>
        </div>
        <p className="mt-10 text-[0.65rem] uppercase tracking-[0.16em] text-slate-600">
          Not financial advice · DYOR
        </p>
      </div>
    </main>
  )
}
