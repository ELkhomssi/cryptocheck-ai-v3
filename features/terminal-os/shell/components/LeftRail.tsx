'use client'

import {
  Activity,
  Bell,
  Bookmark,
  Brain,
  CandlestickChart,
  Copy,
  LayoutGrid,
  LineChart,
  Radar,
  Settings,
  Wallet,
  Waves,
} from 'lucide-react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import { AiTradeLikeMeCard } from '@/features/terminal-os/ai-trade-like-me/components/AiTradeLikeMeCard'
import { AiStatusCard } from '@/features/terminal-os/ai-trade-like-me/components/AiStatusCard'
import { AiAlertsFeed } from '@/features/terminal-os/ai-trade-like-me/components/AiAlertsFeed'

const NAV: { id: TerminalNavId; label: string; icon: typeof LayoutGrid; gated?: boolean }[] = [
  { id: 'terminal', label: 'Terminal', icon: LayoutGrid },
  { id: 'ai-scanner', label: 'AI Scanner', icon: Radar },
  { id: 'market-intel', label: 'Market Intel', icon: LineChart },
  { id: 'whale-tracking', label: 'Whale Tracking', icon: Waves },
  { id: 'execution', label: 'Execution Desk', icon: CandlestickChart },
  { id: 'ai-trading', label: 'AI Trading', icon: Brain },
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

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation">
      <div className="tos-nav-brand">
        <div className="tos-nav-brand-mark">
          CRYPTOCHECK AI
          <br />
          <span data-tos-label>TERMINAL</span> v6.0
        </div>
      </div>

      <nav className="tos-nav-primary" aria-label="Primary">
        {NAV.map((item) => {
          const Icon = item.icon
          const disabled = item.gated && !flags.copyTrading
          const active = activeNav === item.id
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
        <span data-tos-label>Pro · Institutional</span>
      </div>
    </aside>
  )
}
