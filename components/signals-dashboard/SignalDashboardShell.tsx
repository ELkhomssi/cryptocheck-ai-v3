'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Radio, ArrowLeftRight, Shield } from 'lucide-react'
import { SIGNAL_NAV } from '@/lib/signal-aggregator/constants'
import { RevenueWalletPill } from '@/components/revenue-dashboard/RevenueWalletPill'

const NAV = [
  { href: SIGNAL_NAV.feed, label: 'Master Feed', icon: Radio },
  { href: SIGNAL_NAV.agent, label: 'Sentinel Edge', icon: Shield },
] as const

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact,
}: {
  href: string
  label: string
  icon: typeof Radio
  active: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-rd-sm px-3 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider transition-colors ${
        active ? 'bg-rd-green/15 text-rd-green' : 'text-rd-mid hover:bg-white/5 hover:text-rd-hi'
      } ${compact ? 'flex-1 flex-col gap-1 py-2 text-[0.55rem]' : ''}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className={compact ? 'truncate' : ''}>{label}</span>
    </Link>
  )
}

export function SignalSidebar({ compact }: { compact?: boolean }) {
  const pathname = usePathname()
  return (
    <nav className={`flex flex-col gap-1 p-3 ${compact ? 'flex-row justify-around' : ''}`} aria-label="Signals">
      {NAV.map(({ href, label, icon }) => (
        <NavLink
          key={href}
          href={href}
          label={label}
          icon={icon}
          active={pathname === href || (href !== SIGNAL_NAV.feed && Boolean(pathname?.startsWith(href)))}
          compact={compact}
        />
      ))}
      {!compact ? (
        <Link
          href="/dashboard/revenue/terminal"
          className="mt-4 flex items-center gap-2 rounded-rd-sm px-3 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-violet hover:bg-white/5"
        >
          <ArrowLeftRight className="h-4 w-4" aria-hidden />
          Revenue terminal
        </Link>
      ) : null}
    </nav>
  )
}

export function SignalDashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-rd-navy text-rd-hi">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(63,224,90,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(198,232,51,0.06), transparent)',
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-rd-navy2/90 backdrop-blur-xl">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="min-w-0">
            <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
              Signal Aggregator
            </p>
            <h1 className="truncate font-rd-display text-sm font-bold uppercase tracking-[0.08em] text-rd-hi md:text-base">
              Master Feed
            </h1>
          </div>
          <RevenueWalletPill />
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col md:flex-row">
        <aside className="hidden w-52 shrink-0 border-r border-white/[0.06] md:block">
          <SignalSidebar />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-10">{children}</main>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.08] bg-rd-navy2/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <SignalSidebar compact />
      </nav>
    </div>
  )
}
