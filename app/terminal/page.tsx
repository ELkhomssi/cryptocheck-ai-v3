import { Suspense } from 'react'
import { PortfolioDesk } from '@/components/portfolio-desk/PortfolioDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terminal · CryptoCheck AI OS',
  description:
    'CryptoCheck AI Operating System — Mission Control, market intelligence, and institutional execution.',
}

/** Canonical production terminal — /terminal (OS 2.0 shell). Default nav = mission. */
export default function TerminalPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: 'var(--pd-text-dim)' }}>Loading terminal…</div>
      }
    >
      <PortfolioDesk />
    </Suspense>
  )
}
