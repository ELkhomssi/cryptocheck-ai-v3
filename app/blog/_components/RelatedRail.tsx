import Link from 'next/link'
import type { ScoutArticleDraft } from '@/lib/scout/types'

export function RelatedRail({
  articles,
  currentId,
}: {
  articles: ScoutArticleDraft[]
  currentId?: string
}) {
  const related = articles.filter((a) => a.id !== currentId).slice(0, 4)
  if (related.length === 0) return null

  return (
    <section style={{ marginTop: '2.5rem' }} aria-label="Related Intelligence">
      <h2 style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--sb-gold)' }}>
        Related Intelligence
      </h2>
      <ul className="scout-blog__list" style={{ marginTop: '0.75rem' }}>
        {related.map((a) => (
          <li key={a.id} className="scout-blog__list-item" style={{ padding: '0.85rem 0' }}>
            <Link href={`/blog/${a.slug}`}>{a.title}</Link>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--sb-muted)', fontSize: '0.85rem' }}>
              {a.category} · {a.readingMinutes ?? 5} min
            </p>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--sb-muted)' }}>
        Related Decisions →{' '}
        <Link href="/terminalOS" style={{ color: 'var(--sb-lime)' }}>
          Decision Engine in Terminal OS
        </Link>
      </p>
    </section>
  )
}
