import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Code2,
  Crosshair,
  LayoutDashboard,
  ArrowLeftRight,
  Rocket,
} from 'lucide-react'

export type DashboardNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: string
}

/**
 * Trading Workspace primary nav — 5 items max, zero ops/system language.
 * Ops surfaces live under /operator (server-gated).
 */
export const primaryNavItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/investigate', label: 'Dashboard Pro', icon: Code2, badge: 'DEV' },
  { href: '/dashboard/launchpad/swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/dashboard/launchpad/sniper', label: 'Sniper', icon: Crosshair },
  { href: '/launchLab', label: 'LaunchLab', icon: Rocket },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
]

/** @deprecated kept empty — ops moved to /operator */
export const secondaryNavItems: DashboardNavItem[] = []

export const bottomPrimaryNavItems: DashboardNavItem[] = primaryNavItems

export const moreSheetNavItems: DashboardNavItem[] = []

export { MoreHorizontal as moreMenuIcon } from 'lucide-react'

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
