'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Brain,
  Fish,
  HelpCircle,
  History,
  Home,
  Radar,
  ScanSearch,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react'

export type TerminalPane =
  | 'coach'
  | 'copilot'
  | 'opportunities'
  | 'portfolio'
  | 'intel'
  | 'whale'
  | 'watchlists'
  | 'history'
  | 'alerts'
  | 'charts'
  | 'settings'
  | 'help'
  /** legacy aliases kept for keyboard helpers */
  | 'discover'
  | 'sniper'

const MAIN: { id: TerminalPane; icon: LucideIcon; label: string }[] = [
  { id: 'charts', icon: Home, label: 'Home' },
  { id: 'copilot', icon: Brain, label: 'AI Coach' },
  { id: 'coach', icon: ScanSearch, label: 'Scanner' },
  { id: 'intel', icon: Radar, label: 'Market' },
  { id: 'whale', icon: Fish, label: 'Whales' },
  { id: 'opportunities', icon: Sparkles, label: 'Alpha' },
  { id: 'portfolio', icon: Wallet, label: 'Portfolio' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
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
  active,
  onSelect,
}: {
  id: TerminalPane
  icon: LucideIcon
  label: string
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
      className={`tit-rail-btn group relative flex w-full items-center justify-center py-1.5 transition-[color,background] duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
        active ? 'text-[var(--tit-accent)]' : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-0)]'
      }`}
    >
      {active ? <span className="tit-rail-indicator" aria-hidden /> : null}
      <span
        className={`relative flex h-10 w-10 items-center justify-center rounded-[14px] transition-[background,color,box-shadow] duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
          active
            ? 'bg-[rgba(37,99,235,0.1)] text-[var(--tit-accent)]'
            : 'hover:bg-black/[0.04]'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.6} />
        <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 whitespace-nowrap rounded-[10px] border border-[var(--tit-border)] bg-white px-2.5 py-1 text-[0.6875rem] font-semibold text-[var(--tit-text-0)] opacity-0 shadow-[var(--tit-shadow-panel)] transition-opacity duration-[var(--tit-motion)] group-hover:opacity-100">
          {label}
        </span>
      </span>
    </button>
  )
}

/** White Edition icon rail — icons only; labels on hover. */
export function IconRail({ active, onSelect }: Props) {
  const railActive = active === 'discover' ? 'opportunities' : active === 'watchlists' ? 'charts' : active

  return (
    <nav
      className="tit-area-rail flex flex-col border-r border-[var(--tit-border)] bg-white py-4"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-visible px-2">
        {MAIN.map((item) => (
          <RailButton
            key={item.id}
            {...item}
            active={railActive === item.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1 border-t border-[var(--tit-border)] px-2 pt-3">
        {FOOT.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  )
}
