'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Bot,
  Brain,
  Fish,
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

const MAIN: { id: TerminalPane; icon: LucideIcon; label: string; badge?: number }[] = [
  { id: 'copilot', icon: Bot, label: 'AI' },
  { id: 'intel', icon: Radar, label: 'Intel' },
  { id: 'whale', icon: Fish, label: 'Whale' },
  { id: 'opportunities', icon: Sparkles, label: 'Alpha' },
  { id: 'portfolio', icon: Wallet, label: 'Port' },
  { id: 'charts', icon: LineChart, label: 'Charts' },
  { id: 'coach', icon: Brain, label: 'Coach' },
  { id: 'watchlists', icon: LayoutGrid, label: 'Watch' },
  { id: 'history', icon: History, label: 'Hist' },
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
      className={`tit-rail-btn relative flex w-full items-center justify-center py-1.5 transition-[color,background,opacity] duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
        active
          ? 'text-[var(--tit-text-0)]'
          : 'text-[var(--tit-text-2)] hover:text-[var(--tit-text-1)]'
      }`}
    >
      {active ? <span className="tit-rail-indicator" aria-hidden /> : null}
      <span
        className={`relative flex h-9 w-9 items-center justify-center rounded-[8px] transition-[background,color] duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
          active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.6} />
        {badge != null && badge > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--tit-hot)] px-0.5 text-[0.5rem] font-semibold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </span>
    </button>
  )
}

/** Linear-inspired icon rail — icons only, elegant active state. */
export function IconRail({ active, onSelect }: Props) {
  return (
    <nav
      className="tit-area-rail flex flex-col border-r border-[var(--tit-border)] bg-[var(--tit-bg-1)] py-3"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5">
        {MAIN.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--tit-border)] px-1.5 pt-3">
        {FOOT.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}
      </div>
    </nav>
  )
}
