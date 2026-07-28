'use client'

import {
  Activity,
  Bell,
  Bookmark,
  Brain,
  Compass,
  Copy,
  LayoutGrid,
  LineChart,
  Radar,
  Settings,
  Shield,
  Sparkles,
  Users,
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
  { id: 'ai-trading', label: 'AI Trading', icon: Brain },
  { id: 'copy-trading', label: 'Copy Trading', icon: Copy, gated: true },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'discovery', label: 'Discovery', icon: Compass },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'ai-coach', label: 'AI Coach', icon: Sparkles },
  { id: 'ai-workforce', label: 'AI Workforce', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function LeftRail() {
  const activeNav = useTerminalOsStore((s) => s.activeNav)
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const flags = useTerminalOsStore((s) => s.featureFlags)

  return (
    <aside className="tos-left-rail" aria-label="Terminal navigation">
      <div style={{ padding: '14px 14px 10px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: 'var(--tos-accent-gold)',
            lineHeight: 1.35,
          }}
        >
          CRYPTOCHECK AI
          <br />
          <span data-tos-label>TERMINAL</span> v6.0
        </div>
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '0 8px',
          overflow: 'auto',
          flex: '0 1 auto',
          maxHeight: '42%',
        }}
        aria-label="Primary"
      >
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 8,
                border: 'none',
                background: active ? 'var(--tos-accent-gold-dim)' : 'transparent',
                color: active ? 'var(--tos-accent-gold)' : 'var(--tos-text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                textAlign: 'left',
                fontSize: 12,
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon size={16} strokeWidth={2} />
              <span data-tos-label>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <AiTradeLikeMeCard />
        <AiStatusCard />
        <AiAlertsFeed />
      </div>

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--tos-border-subtle)',
          fontSize: 11,
          color: 'var(--tos-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Activity size={14} color="var(--tos-accent-gold)" />
        <span data-tos-label>Pro · Institutional</span>
      </div>
    </aside>
  )
}
