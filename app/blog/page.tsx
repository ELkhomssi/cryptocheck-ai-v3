import type { Metadata } from 'next'
import Link from 'next/link'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { listPublishedArticles } from '@/lib/scout/store'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  title: 'Blog — CryptoCheckAI Scout',
  description:
    'Growth intelligence briefs from CryptoCheckAI Scout — derived from live scanners, market feeds, and security gateway outputs.',
  path: '/blog',
  keywords: ['CryptoCheckAI blog', 'solana security', 'crypto AI', 'Scout'],
})

export default async function BlogIndexPage() {
  const articles = await listPublishedArticles(40)

  return (
    <main className="min-h-screen bg-[#050510] px-6 py-12 text-slate-200 md:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">
          CryptoCheckAI · Scout
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">Growth Intelligence Blog</h1>
        <p className="mt-3 text-sm text-slate-400">
          Articles are composed from CryptoCheckAI engine outputs. Scout never invents market analysis.
        </p>

        {articles.length === 0 ? (
          <p className="mt-10 text-sm text-slate-500">
            No published Scout articles yet. Operators can run a cycle from Terminal OS → Scout and approve drafts.
          </p>
        ) : (
          <ul className="mt-10 space-y-6">
            {articles.map((a) => (
              <li key={a.id} className="border-b border-white/[0.06] pb-6">
                <Link href={`/blog/${a.slug}`} className="text-lg font-semibold text-slate-100 hover:text-[#c8ff00]">
                  {a.title}
                </Link>
                <p className="mt-2 text-sm text-slate-500">{a.introduction.slice(0, 180)}…</p>
                <p className="mt-2 text-[0.65rem] uppercase tracking-[0.14em] text-slate-600">
                  {a.publishedAt?.slice(0, 10) ?? a.createdAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-[0.65rem] uppercase tracking-[0.16em] text-slate-600">{SCOUT_DISCLAIMER}</p>
      </div>
    </main>
  )
}
