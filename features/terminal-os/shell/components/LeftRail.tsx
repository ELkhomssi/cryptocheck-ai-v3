'use client'

/**
 * Persistent command rail — Picture-1 Mission Control hierarchy.
 * Badges + health from real sources only.
 */

import {
  Activity,
  Bell,
  Brain,
  CandlestickChart,
  Crosshair,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
  Wallet,
  Waves,
  Workflow,
} from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import { useRailBadges } from '@/features/terminal-os/shell/hooks/useRailBadges'

type NavItem = {
  id: TerminalNavId
  label: string
  icon: typeof LayoutGrid
  badgeKey?: 'whale' | 'automation' | 'alerts' | 'dna'
}

const NAV: NavItem[] = [
  { id: 'terminal', label: 'AI Gateway', icon: LayoutGrid },
  { id: 'mission-control', label: 'Mission Control', icon: Crosshair },
  { id: 'market-intel', label: 'Market Intelligence', icon: LineChart },
  { id: 'market-intel', label: 'Chart Intelligence', icon: CandlestickChart },
  { id: 'whale-tracking', label: 'Whale Command', icon: Waves, badgeKey: 'whale' },
  { id: 'portfolio', label: 'Portfolio & Risk', icon: Wallet },
  { id: 'execution', label: 'Execution Engine', icon: Sparkles },
  { id: 'ai-trading', label: 'Trade Like Me (DNA)', icon: Brain, badgeKey: 'dna' },
  { id: 'ai-coach', label: 'AI Coach', icon: MessageSquare },
  { id: 'alerts', label: 'Automation Hub', icon: Workflow, badgeKey: 'automation' },
  { id: 'alerts', label: 'Alerts', icon: Bell, badgeKey: 'alerts' },
  { id: 'scout', label: 'Scout', icon: Search },
  { id: 'settings', label: 'System Health', icon: Settings },
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

  const healthPct =
    badges.health.total > 0
      ? Math.round((badges.health.ok / badges.health.total) * 100)
      : null
  const ring = 2 * Math.PI * 36
  const dash =
    healthPct == null ? ring : ring - (healthPct / 100) * ring

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation" data-tos-rail="command">
      <div className="tos-nav-brand">
        <div className="tos-nav-brand-mark">
          MISSION CONTROL
          <br />
          <span data-tos-label>AI COMMAND CENTER</span>
        </div>
        <span className="tos-nav-brand-live" aria-hidden>
          LIVE
        </span>
      </div>

      <nav className="tos-nav-primary" aria-label="Primary">
        {NAV.map((item, idx) => {
          const Icon = item.icon
          const active = activeNav === item.id
          const badge = resolveBadge(item.badgeKey)
          const key = `${item.id}-${item.label}-${idx}`
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveNav(item.id)}
              title={item.label}
              className="tos-nav-item"
              data-active={active ? 'true' : 'false'}
            >
              <Icon size={16} strokeWidth={2} />
              <span data-tos-label>{item.label}</span>
              {badge ? (
                <span className="tos-nav-badge" data-tos-badge="true" aria-label={`${item.label} ${badge}`}>
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div
        className="tos-nav-system"
        data-tos-system-status={badges.health.status}
        aria-live="polite"
      >
        <div className="tos-nav-system-head">
          <Activity size={14} aria-hidden />
          <span data-tos-label>System Status</span>
        </div>
        <div className="tos-nav-gauge" aria-hidden={healthPct == null}>
          <svg viewBox="0 0 84 84" className="tos-nav-gauge-svg">
            <circle cx="42" cy="42" r="36" className="tos-nav-gauge-track" />
            <circle
              cx="42"
              cy="42"
              r="36"
              className="tos-nav-gauge-fill"
              style={{
                strokeDasharray: `${ring}`,
                strokeDashoffset: `${dash}`,
              }}
              data-status={badges.health.status}
            />
          </svg>
          <div className="tos-nav-gauge-label">
            <strong>{healthPct != null ? `${healthPct}%` : '—'}</strong>
            <span>health</span>
          </div>
        </div>
        <p className="tos-nav-system-label">{badges.health.label}</p>
        {badges.health.total > 0 ? (
          <p className="tos-nav-system-meters">
            Engines {badges.health.ok}/{badges.health.total}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
