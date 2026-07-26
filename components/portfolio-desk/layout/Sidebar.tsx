'use client'

import { SunMoon } from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'
import {
  PRIMARY_NAV,
  SYSTEM_NAV,
  type DeskNav,
} from '@/lib/portfolio-desk/nav'
import { usePortfolioTheme } from '@/store/portfolio-theme'

export type { DeskNav }

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

  const isPrimaryActive = (id: DeskNav) => {
    if (active === id) return true
    // Highlight Market when legacy screener/watchlist deep-links land
    if (id === 'market' && (active === 'screener' || active === 'watchlist')) return true
    if (id === 'feed' && active === 'alerts') return true
    if (id === 'settings' && active === 'intelligence') return true
    return false
  }

  return (
    <aside className={`pd-sidebar${mobileOpen ? ' is-open' : ''}`}>
      <div className="pd-brand">
        <div className="pd-mark" aria-hidden />
        <div>
          <div className="pd-brand-name">
            CRYPTO<em>CHECK</em> AI
          </div>
          <div className="pd-brand-sub">OPERATING SYSTEM</div>
        </div>
      </div>

      <nav className="pd-nav" aria-label="Operating system workspaces">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`pd-nav-item${isPrimaryActive(item.id) ? ' is-active' : ''}`}
              onClick={() => pick(item.id)}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </button>
          )
        })}

        <div className="pd-nav-label">SYSTEM</div>
        {SYSTEM_NAV.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className={`pd-nav-item${isPrimaryActive(item.id) ? ' is-active' : ''}`}
              onClick={() => pick(item.id)}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {item.label}
            </button>
          )
        })}
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
            color: 'var(--pd-bg)',
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
