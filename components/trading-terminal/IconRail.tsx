'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Brain,
  Fish,
  HelpCircle,
  History,
  LayoutDashboard,
  Radar,
  ScanSearch,
  Settings,
  Sparkles,
  Star,
  Wallet,
} from 'lucide-react'
import { useSolana } from '@/components/SolanaProvider'

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
  | 'discover'
  | 'sniper'

const MAIN: { id: TerminalPane; icon: LucideIcon; label: string }[] = [
  { id: 'portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'watchlists', icon: Star, label: 'Watchlist' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'copilot', icon: Brain, label: 'AI Coach' },
  { id: 'charts', icon: ScanSearch, label: 'Scanner' },
  { id: 'intel', icon: Radar, label: 'Market' },
  { id: 'whale', icon: Fish, label: 'Whales' },
  { id: 'opportunities', icon: Sparkles, label: 'Alpha' },
  { id: 'history', icon: History, label: 'History' },
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
      className={`group flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
        active
          ? 'bg-[rgba(37,99,235,0.1)] text-[var(--tit-accent)]'
          : 'text-[var(--tit-text-1)] hover:bg-black/[0.03] hover:text-[var(--tit-text-0)]'
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} />
      <span className="truncate text-[0.8125rem] font-semibold tracking-[-0.01em]">{label}</span>
    </button>
  )
}

/** White Edition branded rail — matches institutional mockup. */
export function IconRail({ active, onSelect }: Props) {
  const { isConnected, shortAddr, walletAddress } = useSolana()
  const railActive =
    active === 'discover'
      ? 'opportunities'
      : active === 'coach'
        ? 'charts'
        : active === 'intel'
          ? 'alerts'
          : active

  return (
    <nav
      className="tit-area-rail flex flex-col border-r border-[var(--tit-border)] bg-white px-3 py-5"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[rgba(37,99,235,0.1)] text-[0.7rem] font-bold text-[var(--tit-accent)]"
          aria-hidden
        >
          CC
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] font-bold tracking-tight text-[var(--tit-text-0)]">
            CRYPTOCHECK AI
          </p>
          <p className="truncate text-[0.625rem] font-medium text-[var(--tit-text-2)]">Terminal</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {MAIN.map((item) => (
          <RailButton
            key={item.id}
            {...item}
            active={railActive === item.id || (item.id === 'alerts' && active === 'intel')}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--tit-border)] pt-3">
        {FOOT.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}

        <div className="mt-3 flex items-center gap-2.5 rounded-[16px] border border-[var(--tit-border)] bg-[var(--tit-bg-1)] px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)] text-[0.625rem] font-bold text-[var(--tit-accent)]">
            {isConnected && (shortAddr || walletAddress)
              ? (shortAddr || walletAddress).slice(0, 2).toUpperCase()
              : 'CC'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.75rem] font-semibold text-[var(--tit-text-0)]">
              {isConnected && shortAddr ? shortAddr : 'Guest'}
            </p>
            <p className="flex items-center gap-1 text-[0.625rem] font-semibold text-[var(--tit-accent)]">
              <Wallet className="h-3 w-3" strokeWidth={2} />
              Pro Plan
            </p>
          </div>
        </div>
      </div>
    </nav>
  )
}
