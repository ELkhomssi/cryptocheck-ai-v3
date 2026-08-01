import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLdScript } from '@/components/seo/JsonLd'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { getPublishedArticleBySlug } from '@/lib/scout/store'
import { SCOUT_DISCLAIMER } from '@/lib/scout/constants'

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
    title: seo?.title ?? article.title,
    description: seo?.description ?? article.introduction.slice(0, 155),
    path: seo?.canonicalPath ?? `/blog/${article.slug}`,
    keywords: article.keywords,
    type: 'article',
  })
}

export default async function BlogArticlePage({ params }: Props) {
  const article = await getPublishedArticleBySlug(params.slug)
  if (!article || article.status !== 'published') notFound()

  return (
    <main className="min-h-screen bg-[#050510] px-6 py-12 text-slate-200 md:px-10">
      {article.seo?.jsonLd ? <JsonLdScript data={article.seo.jsonLd} /> : null}
      <article className="mx-auto max-w-3xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#c8ff00]">
          CryptoCheckAI · Scout
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">{article.title}</h1>
        <p className="mt-2 text-xs text-slate-500">
          {article.publishedAt?.slice(0, 10) ?? article.createdAt.slice(0, 10)} · Quality{' '}
          {article.quality?.score ?? '—'}/100
        </p>

        {article.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="text-lg font-semibold text-slate-100">{section.heading}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{section.body}</p>
          </section>
        ))}

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-100">FAQ</h2>
          <dl className="mt-4 space-y-4">
            {article.faq.map((f) => (
              <div key={f.question}>
                <dt className="text-sm font-medium text-slate-200">{f.question}</dt>
                <dd className="mt-1 text-sm text-slate-500">{f.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Continue in product</h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {article.internalLinks.slice(0, 8).map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-flex rounded border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-[#c8ff00]/35 hover:text-[#c8ff00]"
                >
                  {l.anchor}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-[0.65rem] uppercase tracking-[0.16em] text-slate-600">{SCOUT_DISCLAIMER}</p>
      </article>
    </main>
  )
}
