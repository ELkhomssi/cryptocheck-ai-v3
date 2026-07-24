import { PortfolioDesk } from '@/components/portfolio-desk/PortfolioDesk'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Terminal · CryptoCheck AI',
  description:
    'CryptoCheck AI trading terminal — live portfolio, screener, alerts, AI coach, and Jupiter execution.',
}

/** Canonical production terminal — /terminal (formerly /portfolio desk). */
export default function TerminalPage() {
  return <PortfolioDesk />
}
