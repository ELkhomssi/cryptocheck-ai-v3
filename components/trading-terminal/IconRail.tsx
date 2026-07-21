'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Brain,
  HelpCircle,
  History,
  LayoutGrid,
  LineChart,
  Radar,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react'

export type TerminalPane =
  | 'coach'
  | 'opportunities'
  | 'portfolio'
  | 'intel'
  | 'watchlists'
  | 'history'
  | 'alerts'
  | 'charts'
  | 'settings'
  | 'help'
  /** legacy aliases kept for keyboard helpers */
  | 'discover'
  | 'sniper'

const MAIN: { id: TerminalPane; icon: LucideIcon; label: string; badge?: number }[] = [
  { id: 'coach', icon: Brain, label: 'Coach' },
  { id: 'opportunities', icon: Sparkles, label: 'Opportunities' },
  { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
  { id: 'intel', icon: Radar, label: 'Intel Feed' },
  { id: 'watchlists', icon: LayoutGrid, label: 'Watchlist' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'charts', icon: LineChart, label: 'Charts' },
]

const FOOT: { id: TerminalPane; icon: LucideIcon; label: string }[] = [
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'help', icon: HelpCircle, label: 'Help' },
]

type Props = {
  active: TerminalPane
  onSelect: (pane: TerminalPane) => void
}

function RailButton({
  id,
  icon: Icon,
  label,
  badge,
  active,
  onSelect,
}: {
  id: TerminalPane
  icon: LucideIcon
  label: string
  badge?: number
  active: boolean
  onSelect: (p: TerminalPane) => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(id)}
      className={`relative flex w-full flex-col items-center gap-0.5 px-1 py-1.5 transition-colors duration-[var(--tit-motion)] ${
        active
          ? 'bg-[var(--tit-bg-2)] text-[var(--tit-accent)]'
          : 'text-[var(--tit-text-2)] hover:bg-[var(--tit-bg-2)] hover:text-[var(--tit-text-0)]'
      }`}
    >
      {active ? (
        <span className="absolute bottom-1 left-0 top-1 w-0.5 bg-[var(--tit-accent)]" aria-hidden />
      ) : null}
      <span className="relative">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
        {badge != null && badge > 0 ? (
          <span className="absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-hot)] px-0.5 text-[0.45rem] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-center text-[8px] leading-tight tracking-wide">
        {label}
      </span>
    </button>
  )
}

/** Slim icon rail — focuses workstation panes; stays on /terminal. */
export function IconRail({ active, onSelect }: Props) {
  return (
    <nav
      className="tit-area-rail flex flex-col border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)] py-1"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {MAIN.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--tit-border)] pt-1">
        {FOOT.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  )
}
