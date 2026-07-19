import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Bell,
  Code2,
  Crosshair,
  HeartHandshake,
  LayoutDashboard,
  Rocket,
  ScanLine,
} from 'lucide-react'

export type DashNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: 'NEW' | 'HOT'
  /** In-dashboard action — handled by DashboardNew without navigation. */
  panel?: 'scan' | 'swap' | 'sniper' | 'launch' | 'rewards' | 'sports'
  external?: boolean
}

export type DashNavGroup = {
  title: string
  items: DashNavItem[]
}

/** Trading Workspace — LaunchLab is the Raydium-style public create/discover surface. */
export const DASHBOARD_NAV: DashNavGroup[] = [
  {
    title: 'Trade',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/investigate', label: 'Dashboard Pro', icon: Code2, badge: 'NEW' },
      { href: '/dashboard#action-panel', label: 'Scan', icon: ScanLine, panel: 'scan' },
      { href: '/dashboard/launchpad/swap', label: 'Swap', icon: ArrowLeftRight },
      { href: '/dashboard/launchpad/sniper', label: 'Sniper', icon: Crosshair },
      { href: '/launchLab', label: 'LaunchLab', icon: Rocket, badge: 'HOT' },
      { href: '/dashboard/launchpad/saves', label: 'Your Saves', icon: HeartHandshake },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
]

export function isDashNavActive(pathname: string, href: string): boolean {
  if (href.includes('#')) {
    return pathname === '/dashboard'
  }
  if (href.startsWith('/app')) return false
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
