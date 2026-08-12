'use client'

/**
 * Mission Control rail — reference hierarchy (A→Z match).
 * Badges from useRailBadges only — never invent engine totals.
 */

import {
  Bell,
  Brain,
  CandlestickChart,
  Crosshair,
  FlaskConical,
  KeyRound,
  LineChart,
  MessageSquare,
  Settings,
  ShieldAlert,
  Sparkles,
  Wallet,
  Waves,
} from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import { useRailBadges } from '@/features/terminal-os/shell/hooks/useRailBadges'

type NavItem = {
  id: TerminalNavId
  label: string
  icon: typeof Crosshair
  badgeKey?: 'whale' | 'automation' | 'alerts' | 'dna'
}

/** Reference order — Mission Control first (home = terminal). */
const NAV: NavItem[] = [
  { id: 'terminal', label: 'Mission Control', icon: Crosshair },
  { id: 'ai-trading', label: 'Trade Like Me', icon: Brain, badgeKey: 'dna' },
  { id: 'ai-coach', label: 'AI Coaching', icon: MessageSquare },
  { id: 'market-intel', label: 'Market Intelligence', icon: LineChart },
  { id: 'chart-intelligence', label: 'Chart Analysis', icon: CandlestickChart },
  { id: 'whale-tracking', label: 'Wallet Intelligence', icon: Waves, badgeKey: 'whale' },
  { id: 'security', label: 'Risk Engine', icon: ShieldAlert },
  { id: 'discovery', label: 'AI Signals', icon: Sparkles },
  { id: 'ai-scanner', label: 'Rug Forensics', icon: ShieldAlert },
  { id: 'backtesting', label: 'Backtesting', icon: FlaskConical },
  { id: 'scout', label: 'Scout', icon: Sparkles },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'alerts', label: 'Alerts', icon: Bell, badgeKey: 'alerts' },
  { id: 'watchlist', label: 'API Access', icon: KeyRound },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function LeftRail() {
  const activeNav = useTerminalOsStore((s) => s.activeNav)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const badges = useRailBadges()

  const resolveBadge = (key: NavItem['badgeKey']): string | null => {
    if (!key) return null
    if (key === 'whale' && badges.whaleBadge != null) return String(badges.whaleBadge)
    if (key === 'automation' && badges.automationBadge != null) {
      return String(badges.automationBadge)
    }
    if (key === 'alerts' && badges.alertBadge != null) return String(badges.alertBadge)
    if (key === 'dna' && badges.dnaPct != null) return `${badges.dnaPct}%`
    return null
  }

  const healthy = badges.health.status === 'healthy'

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation" data-tos-rail="mission">
      <nav className="tos-nav-primary" aria-label="Primary">
        {NAV.map((item, idx) => {
          const Icon = item.icon
          const active = activeNav === item.id
          const badge = resolveBadge(item.badgeKey)
          return (
            <button
              key={`${item.id}-${idx}`}
              type="button"
              onClick={() => setActiveNav(item.id)}
              title={item.label}
              className="tos-nav-item tos-nav-item--mc"
              data-active={active ? 'true' : 'false'}
            >
              <Icon size={16} strokeWidth={2} />
              <span data-tos-label className="tos-nav-item-label">
                {item.label}
              </span>
              {badge ? (
                <span className="tos-nav-badge" data-tos-badge="true" aria-label={`${item.label} ${badge}`}>
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="tos-nav-upgrade" data-tos-upgrade="true">
        <strong>Upgrade Plan</strong>
        <p>Unlock deeper Decision history and coach capacity.</p>
        <a className="tos-nav-upgrade-btn" href="/api/billing/pro-checkout">
          Upgrade
        </a>
      </div>

      <div
        className="tos-nav-system tos-nav-system--mc"
        data-tos-system-status={badges.health.status}
        aria-live="polite"
      >
        <div className="tos-nav-system-head">
          <span className="tos-nav-sys-dot" data-on={healthy ? 'true' : 'false'} aria-hidden />
          <span data-tos-label>SYSTEM STATUS</span>
        </div>
        <p className="tos-nav-system-label">
          {healthy ? 'All Systems Operational' : badges.health.label}
        </p>
        <p className="tos-nav-copy">© {new Date().getFullYear()} CryptoCheck AI</p>
      </div>
    </aside>
  )
}
