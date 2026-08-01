import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLdScript } from '@/components/seo/JsonLd'
import { reportJsonLd } from '@/lib/seo/json-ld'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublicReportPageData } from '@/lib/seo/page-data'
import EliteReportClient from './EliteReportClient'

type Props = { params: { mint: string } }

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.mint
  if (isUuid(id)) {
    const report = await getPublicReportPageData(id)
    if (!report) {
      return buildPageMetadata({
        title: 'Report not found — CryptoCheckAI',
        description: 'This intelligence report is not available.',
        path: `/report/${id}`,
        noIndex: true,
      })
    }
    const description = report.body.slice(0, 160).replace(/\s+/g, ' ').trim()
    return buildPageMetadata({
      title: `${report.title} — CryptoCheckAI`,
      description: description || `${report.title} intelligence report from CryptoCheckAI.`,
      path: `/report/${report.id}`,
      keywords: ['crypto report', report.reportType, 'CryptoCheckAI', 'AI trading'],
      type: 'article',
    })
  }

  return buildPageMetadata({
    title: 'Intelligence Briefing — CryptoCheckAI',
    description: 'Session intelligence briefing for a Solana mint scanned in CryptoCheckAI.',
    path: `/report/${id}`,
    noIndex: true,
  })
}

export default async function ReportPage({ params }: Props) {
  const id = params.mint

  if (isUuid(id)) {
    const report = await getPublicReportPageData(id)
    if (!report) {
      return (
        <main className="min-h-screen bg-[#050510] p-8 font-mono text-slate-300">
          <p className="text-sm text-slate-500">Report not found.</p>
          <Link href="/" className="mt-6 inline-block text-xs uppercase tracking-wider text-[#c8ff00]">
            ← Home
          </Link>
        </main>
      )
    }

    const description = report.body.slice(0, 240).replace(/\s+/g, ' ').trim()
    return (
      <main className="min-h-screen bg-[#050510] px-6 py-12 text-slate-200 md:px-10">
        <JsonLdScript
          data={reportJsonLd({
            id: report.id,
            title: report.title,
            description: description || report.title,
            createdAt: report.createdAt,
            reportType: report.reportType,
          })}
        />
        <article className="mx-auto max-w-3xl">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">
            CryptoCheckAI · Report
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">{report.title}</h1>
          <p className="mt-2 text-xs text-slate-500">
            {report.reportType.replace(/_/g, ' ')} · {report.createdAt.slice(0, 10)} · {report.eventCount} events
          </p>
          <pre className="mt-8 whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-300">
            {report.body}
          </pre>
          <p className="mt-10 text-[0.65rem] uppercase tracking-[0.16em] text-slate-600">
            Not financial advice · DYOR
          </p>
        </article>
      </main>
    )
  }

  return <EliteReportClient mint={id} />
}
