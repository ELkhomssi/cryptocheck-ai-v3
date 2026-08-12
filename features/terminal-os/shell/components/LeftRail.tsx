'use client'

/**
 * Classic Terminal v6 rail — Trade Like Me is the moat activator.
 * Badges/status from real DNA engine only — never invent progress.
 */

import {
  Activity,
  Bell,
  Bookmark,
  Brain,
  CandlestickChart,
  Copy,
  Crosshair,
  LayoutGrid,
  LineChart,
  MessageSquare,
  Radar,
  Search,
  Settings,
  Wallet,
  Waves,
} from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import { AiTradeLikeMeCard } from '@/features/terminal-os/ai-trade-like-me/components/AiTradeLikeMeCard'
import { AiStatusCard } from '@/features/terminal-os/ai-trade-like-me/components/AiStatusCard'
import { AiAlertsFeed } from '@/features/terminal-os/ai-trade-like-me/components/AiAlertsFeed'
import { useRailBadges } from '@/features/terminal-os/shell/hooks/useRailBadges'

const NAV: { id: TerminalNavId; label: string; icon: typeof LayoutGrid; gated?: boolean }[] = [
  { id: 'terminal', label: 'Terminal', icon: LayoutGrid },
  { id: 'mission-control', label: 'Mission Control', icon: Crosshair },
  { id: 'ai-scanner', label: 'AI Scanner', icon: Radar },
  { id: 'market-intel', label: 'Market Intel', icon: LineChart },
  { id: 'whale-tracking', label: 'Whale Tracking', icon: Waves },
  { id: 'chart-intelligence', label: 'Chart Intelligence', icon: CandlestickChart },
  { id: 'execution', label: 'Execution Desk', icon: CandlestickChart },
  { id: 'ai-trading', label: 'AI Trading', icon: Brain },
  { id: 'ai-coach', label: 'AI Coach', icon: MessageSquare },
  { id: 'scout', label: 'Scout', icon: Search },
  { id: 'copy-trading', label: 'Copy Trading', icon: Copy, gated: true },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function LeftRail() {
  const activeNav = useTerminalOsStore((s) => s.activeNav)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const flags = useTerminalOsStore((s) => s.featureFlags)
  const badges = useRailBadges()

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation" data-tos-rail="classic">
      <div className="tos-nav-brand">
        <div className="tos-nav-brand-mark">
          CRYPTOCHECK AI
          <br />
          <span data-tos-label>TERMINAL OS</span>
        </div>
        <span className="tos-nav-brand-live" aria-hidden>
          PRO
        </span>
      </div>

      <nav className="tos-nav-primary" aria-label="Primary">
        {NAV.map((item) => {
          const Icon = item.icon
          const disabled = item.gated && !flags.copyTrading
          const active = activeNav === item.id
          const whale =
            item.id === 'whale-tracking' && badges.whaleBadge != null
              ? String(badges.whaleBadge)
              : null
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setActiveNav(item.id)}
              title={disabled ? 'Copy Trading gated (feature flag OFF)' : item.label}
              className="tos-nav-item"
              data-active={active ? 'true' : 'false'}
            >
              <Icon size={16} strokeWidth={2} />
              <span data-tos-label>{item.label}</span>
              {whale ? (
                <span className="tos-nav-badge" data-tos-badge="true">
                  {whale}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="tos-nav-aside-stack">
        <AiTradeLikeMeCard />
        <AiStatusCard />
        <AiAlertsFeed />
      </div>

      <div className="tos-nav-footer">
        <Activity size={14} color="var(--tos-accent-gold)" />
        <span data-tos-label>
          {badges.health.status === 'healthy'
            ? 'Pro · Institutional'
            : badges.health.label}
        </span>
      </div>
    </aside>
  )
}
