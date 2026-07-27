/**
 * Phase 15 — desk information architecture.
 * Reorganize / reframe only: legacy nav ids still resolve; nothing deleted.
 */

import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeftRight,
  Crosshair,
  LayoutDashboard,
  Radar,
  Rocket,
  Settings,
  Sparkles,
  Workflow,
} from 'lucide-react'

/** Canonical + legacy desk nav ids (legacy kept reachable via normalizeDeskNav). */
export type DeskNav =
  | 'mission'
  | 'market'
  | 'trade'
  | 'portfolio'
  | 'launchlab'
  | 'automation'
  | 'feed'
  | 'settings'
  | 'intelligence'
  // legacy (Phase 10–13)
  | 'screener'
  | 'watchlist'
  | 'alerts'
  | 'coach'
  | 'employees'

export type DeskNavPrimary =
  | 'mission'
  | 'market'
  | 'trade'
  | 'portfolio'
  | 'launchlab'
  | 'automation'

export const PRIMARY_NAV: { id: DeskNavPrimary; label: string; icon: LucideIcon }[] = [
  { id: 'mission', label: 'Mission Control', icon: Crosshair },
  { id: 'market', label: 'Market Intelligence', icon: Radar },
  { id: 'trade', label: 'Trading', icon: ArrowLeftRight },
  { id: 'portfolio', label: 'Portfolio Intelligence', icon: LayoutDashboard },
  { id: 'launchlab', label: 'LaunchLab', icon: Rocket },
  { id: 'automation', label: 'Automation', icon: Workflow },
]

export const SYSTEM_NAV: { id: DeskNav; label: string; icon: LucideIcon }[] = [
  { id: 'feed', label: 'Mission Feed', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
]

/** Map legacy query params / deep-links onto Phase 15 surfaces. */
export function normalizeDeskNav(raw: string | null | undefined): DeskNav {
  const q = (raw || '').trim()
  switch (q) {
    case 'screener':
      return 'market'
    case 'watchlist':
      return 'market'
    case 'alerts':
      return 'feed'
    case 'employees':
      return 'intelligence'
    case 'coach':
      return 'mission' // coach remains in aside; home is Mission Control
    case 'mission':
    case 'market':
    case 'trade':
    case 'portfolio':
    case 'launchlab':
    case 'automation':
    case 'feed':
    case 'settings':
    case 'intelligence':
      return q
    default:
      return 'mission'
  }
}

/** Preserve watchlist deep-link as market tab=tracked. */
export function marketTabFromLegacy(raw: string | null | undefined): string | null {
  if (raw === 'watchlist') return 'tracked'
  return null
}

export const PAGE_META: Record<
  DeskNav,
  { kicker: string; title: string; subtitle: string }
> = {
  mission: {
    kicker: '// MISSION CONTROL',
    title: 'Mission Control',
    subtitle: 'The OS speaks first. Conversation only.',
  },
  market: {
    kicker: '// MARKET INTELLIGENCE',
    title: 'Market Intelligence',
    subtitle: 'Analyst conclusions first — evidence, charts, and raw metrics below.',
  },
  trade: {
    kicker: '// TRADING',
    title: 'Institutional Execution',
    subtitle: 'Risk-gated Jupiter swaps with non-custodial confirmation. Guardrails unchanged.',
  },
  portfolio: {
    kicker: '// PORTFOLIO INTELLIGENCE',
    title: 'Portfolio Intelligence',
    subtitle: 'Health, risk, and allocation first — holdings as supporting detail.',
  },
  launchlab: {
    kicker: '// LAUNCHLAB',
    title: 'LaunchLab',
    subtitle: 'Token creation workspace — safety defaults enforced; full OS surface lands in 15.9.',
  },
  automation: {
    kicker: '// AUTOMATION',
    title: 'Automation',
    subtitle: 'Recipe-style rules backed by live agent activity — no fabricated runs.',
  },
  feed: {
    kicker: '// MISSION FEED',
    title: 'Mission Feed',
    subtitle: 'Chronological market, risk, automation, and portfolio events.',
  },
  settings: {
    kicker: '// SETTINGS',
    title: 'Settings',
    subtitle: 'Account, appearance, notifications, providers, and Intelligence Engine.',
  },
  intelligence: {
    kicker: '// INTELLIGENCE ENGINE',
    title: 'Intelligence Engine',
    subtitle: 'Advanced employee roster and orchestrator — relocated from primary nav.',
  },
  // legacy titles (still used if something renders raw id before normalize)
  screener: {
    kicker: '// MARKET INTELLIGENCE',
    title: 'Market Intelligence',
    subtitle: 'Filter and rank live Solana markets by liquidity, risk, and AI score.',
  },
  watchlist: {
    kicker: '// TRACKED',
    title: 'Tracked Tokens',
    subtitle: 'Persisted watchlist — now under Market Intelligence.',
  },
  alerts: {
    kicker: '// MISSION FEED',
    title: 'Mission Feed',
    subtitle: 'Alerts relocated into the Mission Feed.',
  },
  coach: {
    kicker: '// AI COACH',
    title: 'AI Coach',
    subtitle: 'Still available in the side rail.',
  },
  employees: {
    kicker: '// INTELLIGENCE ENGINE',
    title: 'Intelligence Engine',
    subtitle: 'Employee roster — open via Settings → Advanced.',
  },
}

/** Surfaces that do not require a connected wallet. */
export const PUBLIC_NAV = new Set<DeskNav>([
  'mission',
  'market',
  'screener',
  'watchlist',
  'feed',
  'alerts',
  'intelligence',
  'employees',
  'settings',
  'automation',
  'launchlab',
])
