import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLdScript } from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublishedArticleBySlug, listPublishedArticles } from '@/lib/scout/store'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'
import { IntelligenceCards } from '../_components/IntelligenceCards'
import { RelatedRail } from '../_components/RelatedRail'
import { StickyToc } from '../_components/StickyToc'
import { TerminalOsCta } from '../_components/TerminalOsCta'
import '../blog.css'

export const dynamic = 'force-dynamic'

type Props = { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getPublishedArticleBySlug(params.slug)
  if (!article) {
    return buildPageMetadata({
      title: 'Article not found — CryptoCheckAI',
      description: 'This Scout article is not published.',
      path: `/blog/${params.slug}`,
      noIndex: true,
    })
  }
  const seo = article.seo
  return buildPageMetadata({
    title: seo?.title ?? article.metaTitle ?? article.title,
    description: seo?.description ?? article.metaDescription ?? article.introduction.slice(0, 155),
    path: seo?.canonicalPath ?? `/blog/${article.slug}`,
    keywords: [...article.keywords, ...(article.semanticKeywords ?? [])],
    type: 'article',
  })
}

export default async function BlogArticlePage({ params }: Props) {
  const article = await getPublishedArticleBySlug(params.slug)
  if (!article || article.status !== 'published') notFound()

  const related = await listPublishedArticles(8)

  return (
    <main className="scout-blog">
      {article.seo?.jsonLd ? <JsonLdScript data={article.seo.jsonLd} /> : null}
      <div className="scout-blog__shell">
        <p className="scout-blog__brand scout-blog__animate">CryptoCheckAI · Scout</p>
        <h1 className="scout-blog__h1 scout-blog__animate scout-blog__animate-delay-1">
          {article.title}
        </h1>
        <div className="scout-blog__meta-row scout-blog__animate scout-blog__animate-delay-2">
          <span className="scout-blog__chip scout-blog__chip--gold">
            {article.category || 'Intelligence'}
          </span>
          <span className="scout-blog__chip">~{article.readingMinutes ?? 5} min read</span>
          <span className="scout-blog__chip">
            AI confidence {article.aiConfidence ?? article.quality?.score ?? '—'}%
          </span>
          <span>{article.publishedAt?.slice(0, 10) ?? article.createdAt.slice(0, 10)}</span>
        </div>

        <div className="scout-blog__grid scout-blog__grid--article">
          <StickyToc sections={article.sections} />

          <article className="scout-blog__article">
            {article.sections.map((section) => {
              const id =
                section.id || section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')
              return (
                <section key={id} id={id}>
                  <h2>{section.heading}</h2>
                  <div className="scout-blog__body">{section.body}</div>
                </section>
              )
            })}

            <section id="faq" style={{ marginTop: '2.5rem' }}>
              <h2>FAQ</h2>
              <dl className="scout-blog__faq">
                {article.faq.map((f) => (
                  <div key={f.question}>
                    <dt>{f.question}</dt>
                    <dd>{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section style={{ marginTop: '2.5rem' }} aria-label="Related Decisions">
              <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sb-gold)' }}>
                Related Decisions
              </h2>
              <IntelligenceCards />
            </section>

            <section style={{ marginTop: '2rem' }}>
              <h2 style={{ fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sb-muted)' }}>
                Live product surfaces
              </h2>
              <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', margin: '0.85rem 0 0', padding: 0, listStyle: 'none' }}>
                {article.internalLinks.slice(0, 10).map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="scout-blog__chip">
                      {l.anchor}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <TerminalOsCta />
            <RelatedRail articles={related} currentId={article.id} />
            <p className="scout-blog__disclaimer">{SCOUT_DISCLAIMER}</p>
          </article>
        </div>
      </div>
    </main>
  )
}
