import Link from 'next/link'

export function TerminalOsCta() {
  return (
    <aside className="scout-blog__cta" aria-label="Terminal OS">
      <h2>Open Terminal OS</h2>
      <p>
        Stop collecting tabs. Run Intelligence Chart, Security Scanner, AI Coaching, and Secure
        Execution in one operating system — evidence-bound, non-custodial, no profit promises.
      </p>
      <div className="scout-blog__cta-actions">
        <Link href="/terminalOS" className="scout-blog__btn">
          Launch Terminal OS
        </Link>
        <Link href="/app" className="scout-blog__btn scout-blog__btn--ghost">
          Open App
        </Link>
        <Link href="/scanner" className="scout-blog__btn scout-blog__btn--ghost">
          Security Scanner
        </Link>
      </div>
    </aside>
  )
}
