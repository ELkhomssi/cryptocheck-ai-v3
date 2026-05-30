import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import '../dashboard/web4-terminal/web4-terminal.css'

export const metadata: Metadata = {
  title: 'Web4.fun — Solana Memecoin Launchpad',
  description:
    'Create tokens, trade on the bonding curve, and explore trenches — consumer trading surface by CryptoCheck.',
}

export const viewport: Viewport = {
  themeColor: '#111111',
}

export default function Web4RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#111] text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-[#2a2a2a] px-3 py-2 text-xs text-[#666]">
        <span>Web4 Protocol · mainnet bonding curve · not financial advice</span>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[#888] transition hover:text-[#86efac]"
        >
          Developer console
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
