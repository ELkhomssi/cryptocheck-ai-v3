import type { ArticleSection } from '@/lib/scout/types'

export function StickyToc({ sections }: { sections: ArticleSection[] }) {
  const items = sections.filter((s) => s.id || s.heading).slice(0, 12)
  if (items.length === 0) return null

  return (
    <nav className="scout-blog__toc" aria-label="Table of contents">
      <h2>Contents</h2>
      <ol>
        {items.map((s) => {
          const id = s.id || s.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          return (
            <li key={id}>
              <a href={`#${id}`}>{s.heading}</a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
