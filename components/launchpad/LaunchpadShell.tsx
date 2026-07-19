'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { RevenueWalletPill } from '@/components/revenue-dashboard/RevenueWalletPill'
import { LAUNCHPAD_BASE_PATH, LAUNCHPAD_COMPLIANCE } from '@/lib/launchpad/constants'
import { LAUNCHPAD_SIDEBAR } from '@/lib/launchpad/nav'

/** Shell for Launchpad product pages under `/dashboard/launchpad/*` (route path only). */
export function LaunchpadShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="relative min-h-screen bg-rd-navy text-rd-hi">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(63,224,90,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(34,197,94,0.06), transparent)',
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-rd-navy2/90 backdrop-blur-xl">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="min-w-0">
            <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
              CryptoCheck
            </p>
            <h1 className="truncate font-rd-display text-sm font-bold uppercase tracking-[0.08em] text-rd-hi md:text-base">
              Launchpad
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden items-center gap-1 text-[11px] text-rd-mid hover:text-rd-hi sm:flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Command center
            </Link>
            <RevenueWalletPill />
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] md:block">
          <nav className="flex flex-col gap-1 p-3" aria-label="Launchpad">
            {LAUNCHPAD_SIDEBAR.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== LAUNCHPAD_BASE_PATH && Boolean(pathname?.startsWith(href)))
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-rd-sm px-3 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider transition-colors ${
                    active ? 'bg-rd-green/15 text-rd-green' : 'text-rd-mid hover:bg-white/5 hover:text-rd-hi'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-10">
          {children}
          <p className="mt-10 text-[10px] leading-relaxed text-rd-lo">{LAUNCHPAD_COMPLIANCE}</p>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/[0.08] bg-rd-navy2/95 backdrop-blur-xl md:hidden"
        aria-label="Launchpad mobile"
      >
        {LAUNCHPAD_SIDEBAR.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== LAUNCHPAD_BASE_PATH && Boolean(pathname?.startsWith(href)))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[0.5rem] font-bold uppercase tracking-wider ${
                active ? 'text-rd-green' : 'text-rd-mid'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
