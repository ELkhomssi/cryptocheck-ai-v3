import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  CreditCard,
  KeyRound,
  LayoutDashboard,
  MoreHorizontal,
  Radar,
  Scan,
  Shield,
} from 'lucide-react'

export type DashboardNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/** Five in-app dashboard routes (control plane). */
export const primaryNavItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/api-keys', label: 'Credentials', icon: KeyRound },
  { href: '/dashboard/usage', label: 'Intelligence Ops', icon: BarChart3 },
  { href: '/dashboard/security', label: 'SENTINEL', icon: Shield },
  { href: '/dashboard/billing', label: 'Subscription', icon: CreditCard },
]

/** Separate product surface — authenticated console + public demo */
export const secondaryNavItems: DashboardNavItem[] = [
  { href: '/dashboard/intelligence-terminal', label: 'Analysis Console', icon: Scan },
  { href: '/pro/dashboard', label: 'Intelligence Terminal', icon: Radar },
]

/** Mobile bottom bar: four primaries + More sheet for Ops + Terminal. */
export const bottomPrimaryNavItems: DashboardNavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/api-keys', label: 'Credentials', icon: KeyRound },
  { href: '/dashboard/billing', label: 'Subscription', icon: CreditCard },
  { href: '/dashboard/security', label: 'SENTINEL', icon: Shield },
]

export const moreSheetNavItems: DashboardNavItem[] = [
  { href: '/dashboard/usage', label: 'Intelligence Ops', icon: BarChart3 },
  ...secondaryNavItems,
]

export const moreMenuIcon = MoreHorizontal

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
