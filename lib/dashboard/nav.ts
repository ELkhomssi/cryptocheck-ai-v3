import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  Code2,
  Cpu,
  FileText,
  FlaskConical,
  Gem,
  Heart,
  Radio,
  ScanLine,
  TrendingUp,
  Wallet,
  Waves,
} from 'lucide-react'
import { appToolUrl } from './app-routes'

export type DashNavItem = {
  href: string
  label: string
  icon: LucideIcon
  badge?: 'NEW' | 'HOT'
  external?: boolean
}

export type DashNavGroup = {
  title: string
  items: DashNavItem[]
}

/** Command-center sidebar — tools open /app; feed + API keys stay on /dashboard routes. */
export const DASHBOARD_NAV: DashNavGroup[] = [
  {
    title: 'Analyze',
    items: [
      { href: appToolUrl('scanner'), label: 'Token Scanner', icon: ScanLine, external: true },
      { href: appToolUrl('neuralv4'), label: 'Neural V4', icon: Cpu, external: true },
      { href: appToolUrl('forensics'), label: 'Forensics Lab', icon: FlaskConical, external: true },
      { href: appToolUrl('portfolio'), label: 'Portfolio Scanner', icon: Wallet, external: true },
    ],
  },
  {
    title: 'Discover',
    items: [
      { href: '/dashboard/signals', label: 'Smart Alpha Feed', icon: Radio, badge: 'NEW' },
      { href: appToolUrl('whales'), label: 'Smart Money Tracker', icon: Banknote, external: true },
      { href: '/dashboard#early-gems', label: 'Early Gem Detector', icon: Gem },
      { href: appToolUrl('whales'), label: 'Whale Activity', icon: Waves, external: true },
      { href: appToolUrl('alpha'), label: 'Trending Tokens', icon: TrendingUp, external: true },
    ],
  },
  {
    title: 'Trade',
    items: [
      { href: '/dashboard#hot-opportunities', label: 'Swap', icon: ArrowLeftRight, badge: 'HOT' },
      { href: '/dashboard/watchlist', label: 'Watchlist', icon: Heart },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Developer',
    items: [
      { href: '/dashboard/api-keys', label: 'API Access', icon: Code2 },
      { href: '/docs', label: 'Documentation', icon: FileText },
    ],
  },
]

export function isDashNavActive(pathname: string, href: string): boolean {
  if (href.includes('#')) return false
  if (href.startsWith('/app')) return false
  if (href === '/dashboard/signals') {
    return pathname === '/dashboard/signals' || pathname.startsWith('/dashboard/signals/')
  }
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
