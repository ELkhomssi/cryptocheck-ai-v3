import type { LucideIcon } from 'lucide-react'
import { Crosshair, HeartHandshake, Rocket, Zap, Bell } from 'lucide-react'
import { LAUNCHPAD_NAV } from './constants'

export type LaunchpadNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/** Align with Trading Workspace — no fee/ops items. */
export const LAUNCHPAD_SIDEBAR: LaunchpadNavItem[] = [
  { href: LAUNCHPAD_NAV.home, label: 'Overview', icon: Rocket },
  { href: LAUNCHPAD_NAV.swap, label: 'Swap', icon: Zap },
  { href: LAUNCHPAD_NAV.sniper, label: 'Sniper', icon: Crosshair },
  { href: '/launchLab', label: 'LaunchLab', icon: Rocket },
  { href: LAUNCHPAD_NAV.saves, label: 'Your Saves', icon: HeartHandshake },
  { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
]
