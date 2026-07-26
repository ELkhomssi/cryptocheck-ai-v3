'use client'

import {
  ArrowLeftRight,
  Bell,
  Brain,
  LayoutDashboard,
  Settings,
  Star,
  SunMoon,
  Table2,
  Users,
} from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import { usePortfolioTheme } from '@/store/portfolio-theme'

export type DeskNav =
  | 'portfolio'
  | 'screener'
  | 'trade'
  | 'watchlist'
  | 'alerts'
  | 'coach'
  | 'employees'
  | 'settings'

const ITEMS: { id: DeskNav; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'portfolio', label: 'Portfolio', icon: LayoutDashboard },
  { id: 'screener', label: 'Screener', icon: Table2 },
  { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'coach', label: 'AI Coach', icon: Brain },
  { id: 'employees', label: 'AI Employees', icon: Users },
]

export function Sidebar({
  active,
  onSelect,
  mobileOpen = false,
  onCloseMobile,
}: {
  active: DeskNav
  onSelect: (id: DeskNav) => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}) {
  const { shortAddr, isConnected } = useSolana()
  const toggle = usePortfolioTheme((s) => s.toggle)
  const theme = usePortfolioTheme((s) => s.theme)

  const pick = (id: DeskNav) => {
    onSelect(id)
    onCloseMobile?.()
  }

  return (
    <aside className={`pd-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <div className="pd-brand">
        <div className="pd-mark" aria-hidden />
        <div>
          <div className="pd-brand-name">
            CRYPTO<em>CHECK</em> AI
          </div>
          <div className="pd-brand-sub">TRADING TERMINAL</div>
        </div>
      </div>

      <nav className="pd-nav" aria-label="Portfolio desk">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`pd-nav-item${active === item.id ? ' is-active' : ''}`}
              onClick={() => pick(item.id)}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </button>
          )
        })}

        <div className="pd-nav-label">SYSTEM</div>
        <button
          type="button"
          className={`pd-nav-item${active === 'settings' ? ' is-active' : ''}`}
          onClick={() => pick('settings')}
        >
          <Settings className="h-4 w-4" strokeWidth={1.6} />
          Settings
        </button>
        <button type="button" className="pd-nav-item" onClick={() => toggle()}>
          <SunMoon className="h-4 w-4" strokeWidth={1.6} />
          Theme · {theme === 'dark' ? 'Dark' : 'Light'}
        </button>
      </nav>

      <div className="pd-sidebar-foot">
        <div
          aria-hidden
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--pd-chain), var(--pd-accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-ibm-plex-mono), monospace',
            fontSize: 11,
            fontWeight: 700,
            color: '#0A0D12',
            flexShrink: 0,
          }}
        >
          {isConnected && shortAddr ? shortAddr.slice(0, 2) : 'CC'}
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
            {isConnected && shortAddr ? shortAddr : 'Guest'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--pd-text-faint)' }}>
            {isConnected ? 'Connected' : 'Not connected'}
          </div>
        </div>
      </div>
    </aside>
  )
}
