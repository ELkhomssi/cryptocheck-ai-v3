'use client'

import Link from 'next/link'
import {
  bottomPrimaryNavItems,
  isNavActive,
  type DashboardNavItem,
} from '@/components/Dashboard/dashboard-nav-config'

function tapFeedback() {
  if (typeof navigator === 'undefined') return
  navigator.vibrate?.(8)
}

function BottomItem({
  item,
  pathname,
}: {
  item: DashboardNavItem
  pathname: string
}) {
  const { href, label, icon: Icon } = item
  const active = isNavActive(pathname, href)
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => tapFeedback()}
      className={`relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-3 font-mono text-[10px] font-medium ${
        active ? 'text-emerald-400' : 'text-zinc-500'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400" aria-hidden />}
      <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.5} aria-hidden />
      <span className={`max-w-[4.5rem] truncate text-center leading-tight ${active ? 'font-semibold text-zinc-100' : ''}`}>
        {label}
      </span>
    </Link>
  )
}

export function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/[0.08] bg-[rgba(5,5,5,0.94)] backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-label="Primary"
    >
      {bottomPrimaryNavItems.map((item) => (
        <BottomItem key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  )
}
