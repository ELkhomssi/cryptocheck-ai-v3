import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLdScript } from '@/components/seo/JsonLd'
import { tokenJsonLd } from '@/lib/seo/json-ld'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublicTokenPageData } from '@/lib/seo/page-data'

type Props = { params: { mint: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicTokenPageData(params.mint)
  if (!data) {
    return buildPageMetadata({
      title: 'Token not found — CryptoCheckAI',
      description: 'This Solana token is not in the CryptoCheckAI indexed scan set.',
      path: `/token/${params.mint}`,
      noIndex: true,
    })
  }
  const title = `${data.name} (${data.symbol}) Solana Scan — CryptoCheckAI`
  const description =
    data.evidenceLine ||
    `CryptoCheckAI security scan for ${data.mint}: verdict ${data.verdict ?? 'UNKNOWN'}, safety score ${data.safetyScore ?? 'n/a'}.`
  return buildPageMetadata({
    title,
    description,
    path: `/token/${data.mint}`,
    keywords: ['solana scanner', 'rug checker', data.symbol, data.verdict ?? 'token scan', 'CryptoCheckAI'],
    type: 'article',
  })
}

export default async function TokenPublicPage({ params }: Props) {
  const data = await getPublicTokenPageData(params.mint)
  if (!data) notFound()

  const description =
    data.evidenceLine ||
    `Indexed CryptoCheckAI scan for mint ${data.mint}.`

  return (
    <main className="min-h-screen bg-[#050510] px-6 py-12 text-slate-200 md:px-10">
      <JsonLdScript
        data={tokenJsonLd({
          mint: data.mint,
          name: data.name,
          symbol: data.symbol,
          description,
          verdict: data.verdict,
          safetyScore: data.safetyScore,
          scannedAt: data.scannedAt,
        })}
      />
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">
          CryptoCheckAI · Token
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">
          {data.name}{' '}
          <span className="text-slate-500">({data.symbol})</span>
        </h1>
        <p className="mt-2 break-all text-xs text-slate-500">{data.mint}</p>
        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Verdict</dt>
            <dd className="mt-1 font-semibold text-slate-100">{data.verdict ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Safety</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {data.safetyScore != null ? `${data.safetyScore}/100` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">Scanned</dt>
            <dd className="mt-1 font-semibold text-slate-100">
              {data.scannedAt ? data.scannedAt.slice(0, 10) : '—'}
            </dd>
          </div>
        </dl>
        {data.evidenceLine ? (
          <p className="mt-6 text-sm leading-relaxed text-slate-400">{data.evidenceLine}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/scanner?mint=${encodeURIComponent(data.mint)}`}
            className="inline-flex rounded-lg border border-[#c8ff00]/35 bg-[#c8ff00]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c8ff00]"
          >
            Rescan
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
