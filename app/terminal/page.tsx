import { Suspense } from 'react'
import { PortfolioDesk } from '@/components/portfolio-desk/PortfolioDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terminal · CryptoCheck AI OS',
  description:
    'CryptoCheck AI Operating System — portfolio intelligence, market desk, and institutional execution.',
}

/** Canonical production terminal — /terminal. Default nav = portfolio (connect wallet). */
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
