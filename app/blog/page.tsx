import type { Metadata } from 'next'
import Link from 'next/link'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { listPublishedArticles } from '@/lib/scout/store'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'
import { IntelligenceCards } from './_components/IntelligenceCards'
import { TerminalOsCta } from './_components/TerminalOsCta'
import './blog.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildPageMetadata({
  title: 'Intelligence Blog — CryptoCheckAI Scout',
  description:
    'Growth intelligence from CryptoCheckAI Scout — Terminal OS education, security, decision intelligence, and AI Gateway. Never generic crypto blogging.',
  path: '/blog',
  keywords: [
    'CryptoCheckAI blog',
    'Terminal OS',
    'AI Gateway',
    'Security Scanner',
    'decision intelligence',
    'Scout',
  ],
})

export default async function BlogIndexPage() {
  const articles = await listPublishedArticles(40)

  return (
    <main className="scout-blog">
      <div className="scout-blog__shell">
        <p className="scout-blog__brand scout-blog__animate">CryptoCheckAI · Scout V2</p>
        <h1 className="scout-blog__h1 scout-blog__animate scout-blog__animate-delay-1">
          Intelligence Blog
        </h1>
        <p className="scout-blog__lede scout-blog__animate scout-blog__animate-delay-2">
          Autonomous Growth Intelligence — educate first, reinforce Terminal OS, cite live engines.
          Scout never invents market analysis or promises profits.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <IntelligenceCards />
        </div>

        {articles.length === 0 ? (
          <p className="scout-blog__lede" style={{ marginTop: '2.5rem' }}>
            No published Scout articles yet. Cron runs every few hours; quality-gated drafts auto-publish
            when priority clears threshold.
          </p>
        ) : (
          <ul className="scout-blog__list">
            {articles.map((a) => (
              <li key={a.id} className="scout-blog__list-item">
                <div className="scout-blog__meta-row" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                  <span className="scout-blog__chip scout-blog__chip--gold">
                    {a.category || 'Intelligence'}
                  </span>
                  <span>~{a.readingMinutes ?? 5} min</span>
                  <span>AI confidence {a.aiConfidence ?? a.quality?.score ?? '—'}%</span>
                </div>
                <Link href={`/blog/${a.slug}`}>{a.title}</Link>
                <p style={{ margin: '0.55rem 0 0', color: 'var(--sb-muted)', fontSize: '0.95rem', lineHeight: 1.55 }}>
                  {(a.metaDescription || a.introduction).slice(0, 200)}…
                </p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5c5a66' }}>
                  {a.publishedAt?.slice(0, 10) ?? a.createdAt.slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <TerminalOsCta />
        <p className="scout-blog__disclaimer">{SCOUT_DISCLAIMER}</p>
      </div>
    </main>
  )
}
