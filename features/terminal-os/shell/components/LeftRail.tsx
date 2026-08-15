'use client'

/**
 * Mission Control rail — mockup IA labels, real nav ids + real badges.
 * System Status ok/total comes only from /api/health via useRailBadges — never invent fixed engine totals.
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
  { id: 'terminal', label: 'AI Gateway', icon: LayoutGrid },
  { id: 'mission-control', label: 'Mission Control', icon: Crosshair },
  { id: 'market-intel', label: 'Market Intelligence', icon: LineChart },
  { id: 'chart-intelligence', label: 'Chart Intelligence', icon: CandlestickChart },
  { id: 'whale-tracking', label: 'Whale Command', icon: Waves },
  { id: 'portfolio', label: 'Portfolio & Risk', icon: Wallet },
  { id: 'execution', label: 'Execution Engine', icon: CandlestickChart },
  { id: 'ai-trading', label: 'Trade Like Me (DNA)', icon: Brain },
  { id: 'ai-coach', label: 'AI Coach', icon: MessageSquare },
  { id: 'alerts', label: 'Automation Hub', icon: Bell },
  { id: 'ai-scanner', label: 'AI Scanner', icon: Radar },
  { id: 'scout', label: 'Scout', icon: Search },
  { id: 'copy-trading', label: 'Copy Trading', icon: Copy, gated: true },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'settings', label: 'System Health', icon: Settings },
]

export function LeftRail() {
  const activeNav = useTerminalOsStore((s) => s.activeNav)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const flags = useTerminalOsStore((s) => s.featureFlags)
  const badges = useRailBadges()

  const { ok, total, status, label } = badges.health
  const pct =
    total > 0 && Number.isFinite(ok) ? Math.round((ok / total) * 100) : null

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation" data-tos-rail="mission">
      <div className="tos-nav-brand tos-rail-mc-head">
        <div className="tos-nav-brand-mark">
          <span className="mu-dot mu-dot-live" aria-hidden />{' '}
          <span data-tos-label style={{ color: 'var(--teal, var(--tos-accent-cyan))' }}>
            MISSION CONTROL
          </span>
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-secondary, var(--tos-text-secondary))' }}>
            AI Command Center
          </span>
        </div>
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
          const dna =
            item.id === 'ai-trading' && badges.dnaPct != null ? `${badges.dnaPct}%` : null
          const auto =
            item.id === 'alerts' && badges.automationBadge != null
              ? String(badges.automationBadge)
              : null
          const badge = whale ?? dna ?? auto
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
              {badge ? (
                <span className="tos-nav-badge" data-tos-badge="true">
                  {badge}
                </span>
              ) : item.id === 'execution' && status === 'healthy' ? (
                <span className="tos-nav-badge" data-tos-badge="true" style={{ color: 'var(--emerald, var(--tos-positive))' }}>
                  live
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

      <div
        className="tos-desk-panel tos-rail-system-status"
        data-status={status}
        data-tos-system-status="true"
      >
        <div className="mu-label" style={{ color: 'var(--text-muted, var(--tos-text-muted))' }}>
          System Status
        </div>
        {badges.healthLoading ? (
          <p className="tos-desk-empty" style={{ marginTop: 8 }}>
            Checking systems…
          </p>
        ) : pct == null || total === 0 ? (
          <p className="tos-desk-empty" style={{ marginTop: 8 }}>
            {label}
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <div className="mu-status-pct tos-num">{pct}%</div>
            <div className="mu-status-meta">
              {ok}/{total} engines live
            </div>
          </div>
        )}
      </div>

      <div className="tos-nav-footer">
        <Activity size={14} color="var(--tos-accent-gold)" />
        <span data-tos-label>{label}</span>
      </div>
    </aside>
  )
}
