'use client'

import Link from 'next/link'
import { RevenueSidebar } from './RevenueSidebar'
import { RevenueWalletPill } from './RevenueWalletPill'
import { RevenueComplianceNote } from './RevenueComplianceNote'

export function RevenueDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-rd-navy text-rd-hi">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(63,224,90,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(124,92,252,0.08), transparent)',
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-rd-navy2/90 backdrop-blur-xl">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="min-w-0">
            <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-green">
              CryptoCheck
            </p>
            <h1 className="truncate font-rd-display text-sm font-bold uppercase tracking-[0.08em] text-rd-hi md:text-base">
              Revenue Terminal
            </h1>
          </div>
          <RevenueWalletPill />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] md:block">
          <RevenueSidebar />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-10">
          {children}
          <footer className="mt-10 border-t border-white/[0.06] pt-4">
            <RevenueComplianceNote />
          </footer>
        </main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-rd-navy2/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <RevenueSidebar compact />
      </nav>
    </div>
  )
}
