'use client'

import Link from 'next/link'
import { CryptoCheckLogo } from '@/components/brand/CryptoCheckLogo'
import { AccountMenu } from '@/components/dash-home/AccountMenu'
import {
  isNavActive,
  primaryNavItems,
  type DashboardNavItem,
} from '@/components/Dashboard/dashboard-nav-config'

function NavLinkRow({ item, pathname }: { item: DashboardNavItem; pathname: string }) {
  const { href, label, icon: Icon, badge } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 font-mono text-sm tracking-wide transition-colors ${
        active
          ? 'bg-white/[0.06] text-zinc-50'
          : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : 'text-zinc-600'}`}
        strokeWidth={active ? 2 : 1.35}
      />
      <span className="truncate">{label}</span>
      {badge ? (
        <span
          className={`ml-auto shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
            active
              ? 'border-sky-400/35 bg-sky-400/10 text-sky-300'
              : 'border-white/[0.08] bg-white/[0.03] text-zinc-600 group-hover:text-sky-300'
          }`}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}

export function DesktopSidebar({
  pathname,
  userEmail,
  isAnonymousPreview = false,
}: {
  pathname: string
  sentinelMode?: boolean
  userEmail: string
  isAnonymousPreview?: boolean
}) {
  const topOffset = isAnonymousPreview ? 'top-24 md:top-20' : 'top-11'
  const name = userEmail ? userEmail.split('@')[0] : 'Guest'

  return (
    <aside
      className={`fixed bottom-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.06] bg-[#050505]/90 backdrop-blur-xl md:flex ${topOffset}`}
    >
      <div className="border-b border-white/[0.06] px-5 py-5">
        <CryptoCheckLogo href="/dashboard" />
        <p className="mt-2 font-mono text-[11px] text-zinc-600">Trading workspace</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Trading">
        {primaryNavItems.map((item) => (
          <NavLinkRow key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="border-t border-white/[0.06] px-4 py-4">
        {userEmail ? (
          <AccountMenu name={name} tier="Account" variant="sidebar" />
        ) : (
          <p className="font-mono text-sm text-zinc-600">
            <Link
              href="/landing?next=%2Fdashboard"
              prefetch={false}
              className="text-emerald-400/90 hover:text-emerald-300"
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </aside>
  )
}
