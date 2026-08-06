import Link from 'next/link'

const CARDS = [
  {
    href: '/terminalOS',
    title: 'Terminal OS',
    body: 'The desk where Intelligence Chart, Scanner, Coaching, and Execution share one decision context.',
  },
  {
    href: '/scanner',
    title: 'Security Scanner',
    body: 'Risk before impulse — gateway verdicts stay friction-heavy on purpose.',
  },
  {
    href: '/docs',
    title: 'AI Gateway',
    body: 'One intelligence contract for builders and desks — the same truth Terminal OS consumes.',
  },
] as const

export function IntelligenceCards() {
  return (
    <div className="scout-blog__cards" aria-label="Related Intelligence">
      {CARDS.map((c) => (
        <Link key={c.href} href={c.href} className="scout-blog__card">
          <strong>{c.title}</strong>
          <span>{c.body}</span>
        </Link>
      ))}
    </div>
  )
}
