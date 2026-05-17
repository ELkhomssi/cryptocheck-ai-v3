import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Web4 Terminal — CryptoCheck AI',
  description:
    'AI-enforced safe launchpad, live market chart, order book, and Web4 debit card hub.',
}

export default function Web4TerminalLayout({ children }: { children: React.ReactNode }) {
  return children
}
