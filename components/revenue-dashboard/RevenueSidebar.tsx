'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Briefcase,
  Bell,
  BadgeCheck,
  KeyRound,
  BarChart3,
} from 'lucide-react'
import { REVENUE_NAV } from '@/lib/revenue-dashboard/constants'

const NAV = [
  { href: REVENUE_NAV.overview, label: 'Overview', icon: LayoutDashboard },
  { href: REVENUE_NAV.terminal, label: 'Terminal', icon: ArrowLeftRight },
  { href: REVENUE_NAV.portfolio, label: 'Portfolio', icon: Briefcase },
  { href: REVENUE_NAV.alerts, label: 'Alerts', icon: Bell },
  { href: REVENUE_NAV.badge, label: 'Verified Badge', icon: BadgeCheck },
  { href: REVENUE_NAV.revenue, label: 'Fees', icon: BarChart3 },
  { href: REVENUE_NAV.api, label: 'API', icon: KeyRound },
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
  icon: typeof LayoutDashboard
  active: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-rd-sm px-3 py-2.5 text-[0.7rem] font-rd-display font-bold uppercase tracking-[0.14em] transition-colors duration-[var(--rd-motion-fast)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rd-green ${
        active
          ? 'bg-rd-green/10 text-rd-green border border-rd-green/30'
          : 'text-rd-mid hover:bg-white/[0.04] hover:text-rd-hi border border-transparent'
      } ${compact ? 'flex-col gap-1 px-2 py-2 text-[0.55rem]' : ''}`}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className={compact ? 'h-4 w-4' : 'h-4 w-4 shrink-0'} strokeWidth={1.75} aria-hidden />
      <span className={compact ? 'leading-tight text-center' : ''}>{label}</span>
    </Link>
  )
}

export function RevenueSidebar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      className={
        compact
          ? 'flex items-stretch justify-around gap-1 px-2 py-2'
          : 'flex flex-col gap-1 p-3'
      }
      aria-label="Revenue dashboard"
    >
      {NAV.map((item) => {
        const active =
          item.href === REVENUE_NAV.overview
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={active}
            compact={compact}
          />
        )
      })}
    </nav>
  )
}
