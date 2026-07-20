import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Bell,
  Crosshair,
  HeartHandshake,
  LayoutDashboard,
  Scan,
} from 'lucide-react'

export type CommandNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: 'NEW' | 'HOT'
}

export type CommandNavGroup = {
  title: string
  items: CommandNavItem[]
}

/** Trading Workspace nav — mirrors trader chrome (ops under /operator). */
export const COMMAND_NAV: CommandNavGroup[] = [
  {
    title: 'Trade',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard#action-panel', label: 'Scan', icon: Scan },
      { href: '/dashboard?mode=swap#action-panel', label: 'Swap', icon: ArrowLeftRight },
      { href: '/dashboard?mode=sniper#action-panel', label: 'Sniper', icon: Crosshair },
      { href: '/dashboard/launchpad/saves', label: 'Your Saves', icon: HeartHandshake },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
]

export const COMMAND_DASHBOARD_LINK: CommandNavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
}

export function isCommandNavActive(pathname: string, href: string): boolean {
  if (href.startsWith('#')) return false
  if (href.includes('#')) return pathname === '/dashboard'
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
