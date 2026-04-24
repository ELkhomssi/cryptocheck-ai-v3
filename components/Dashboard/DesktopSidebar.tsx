'use client'

import Link from 'next/link'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import {
  isNavActive,
  primaryNavItems,
  secondaryNavItems,
  type DashboardNavItem,
} from '@/components/Dashboard/dashboard-nav-config'

function NavLinkRow({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const { href, label, icon: Icon, badge } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        active
          ? 'border-[#00d4aa] bg-white/[0.06] pl-[10px] text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:scale-[1.03] ${
          active ? 'text-[#00d4aa]' : 'text-slate-500 group-hover:text-slate-300'
        }`}
        strokeWidth={active ? 2 : 1.35}
      />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="ml-auto rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-cyan-300">
          {badge}
        </span>
      ) : null}
      {active && (
        <span className="pointer-events-none absolute inset-x-2 bottom-1.5 h-px bg-gradient-to-r from-transparent via-[#00d4aa]/35 to-transparent opacity-90" />
      )}
    </Link>
  )
}

export function DesktopSidebar({
  pathname,
  sentinelMode,
  userEmail,
  isAnonymousPreview = false,
}: {
  pathname: string
  sentinelMode: boolean
  userEmail: string
  isAnonymousPreview?: boolean
}) {
  const topOffset =
    sentinelMode ? 'top-[4.5rem]' : isAnonymousPreview ? 'top-28 md:top-24' : 'top-10'

  return (
    <aside
      className={`fixed bottom-0 left-0 z-40 hidden w-[280px] flex-col border-r border-white/[0.06] bg-[rgba(7,7,8,0.92)] backdrop-blur-[20px] md:flex ${topOffset}`}
    >
      <div className="border-b border-white/[0.05] px-5 py-6">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Control plane</p>
        <div className="mt-2">
          <CryptoCheckLogo href="/dashboard" />
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">Intelligence operations</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        {primaryNavItems.map((item) => (
          <NavLinkRow key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="my-4 border-t border-white/5" role="presentation" />
        <p className="mb-2 px-4 text-[10px] font-medium uppercase tracking-widest text-white/40">PRO SURFACE</p>
        {secondaryNavItems.map((item) => (
          <NavLinkRow key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="border-t border-white/[0.05] px-4 py-4">
        {userEmail ? (
          <p className="truncate text-xs font-medium tracking-wide text-slate-500">{userEmail}</p>
        ) : (
          <p className="text-xs font-medium tracking-wide text-slate-500">
            <span className="text-amber-200/80">Guest preview</span>
            {' · '}
            <Link href="/landing?next=%2Fdashboard" className="text-cyan-400/90 hover:text-cyan-300">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </aside>
  )
}
