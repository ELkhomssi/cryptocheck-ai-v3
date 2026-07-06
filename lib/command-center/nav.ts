import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  BookOpen,
  Brain,
  Eye,
  Gem,
  KeyRound,
  LayoutDashboard,
  Radar,
  Scan,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
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

export const COMMAND_NAV: CommandNavGroup[] = [
  {
    title: 'Analyze',
    items: [
      { href: '/dashboard/revenue/terminal', label: 'Token Scanner', icon: Scan },
      { href: '/dashboard/intelligence-terminal', label: 'Neural V4', icon: Brain },
      { href: '/dashboard/investigate', label: 'Forensics Lab', icon: Eye },
      { href: '/dashboard/revenue/portfolio', label: 'Portfolio Scanner', icon: Wallet },
    ],
  },
  {
    title: 'Discover',
    items: [
      { href: '/dashboard', label: 'Smart Alpha Feed', icon: Activity, badge: 'NEW' },
      { href: '#top-traders', label: 'Top Traders', icon: Users },
      { href: '#early-gems', label: 'Early Gem Detector', icon: Gem },
      { href: '/dashboard/signals', label: 'Trending Tokens', icon: TrendingUp },
    ],
  },
  {
    title: 'Trade',
    items: [
      { href: '/dashboard/revenue/terminal', label: 'Swap', icon: ArrowLeftRight, badge: 'HOT' },
      { href: '/dashboard/revenue/portfolio', label: 'Watchlist', icon: Radar },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Developer',
    items: [
      { href: '/dashboard/api-keys', label: 'API Access', icon: KeyRound },
      { href: '/api/docs', label: 'Documentation', icon: BookOpen },
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
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
