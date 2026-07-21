'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Bell,
  Crosshair,
  History,
  LayoutGrid,
  LineChart,
  Radar,
  Settings,
  Wallet,
} from 'lucide-react'

export type TerminalPane =
  | 'discover'
  | 'charts'
  | 'watchlists'
  | 'sniper'
  | 'portfolio'
  | 'history'
  | 'intel'
  | 'alerts'
  | 'settings'

const ITEMS: { id: TerminalPane; icon: LucideIcon; label: string; badge?: number }[] = [
  { id: 'discover', icon: Radar, label: 'Discover' },
  { id: 'charts', icon: LineChart, label: 'Charts' },
  { id: 'watchlists', icon: LayoutGrid, label: 'Watchlists' },
  { id: 'sniper', icon: Crosshair, label: 'Sniper' },
  { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'intel', icon: Activity, label: 'Intel Feed' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

type Props = {
  active: TerminalPane
  onSelect: (pane: TerminalPane) => void
}

/** Icon rail — focuses workspace panes; never navigates away from the terminal. */
export function IconRail({ active, onSelect }: Props) {
  return (
    <nav
      className="flex shrink-0 flex-col items-center gap-1 border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)] py-2"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      {ITEMS.map(({ id, icon: Icon, label, badge }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={`relative flex h-9 w-9 items-center justify-center rounded transition-colors duration-[var(--tit-motion)] ${
              isActive
                ? 'bg-[var(--tit-accent)]/25 text-[var(--tit-accent-bright)]'
                : 'text-[var(--tit-text-2)] hover:bg-[var(--tit-bg-3)] hover:text-[var(--tit-text-0)]'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {badge != null && badge > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-accent)] px-0.5 text-[0.45rem] font-bold text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
