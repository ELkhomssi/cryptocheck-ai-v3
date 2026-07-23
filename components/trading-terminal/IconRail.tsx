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
  { id: 'charts', icon: ScanSearch, label: 'Scanner' },
  { id: 'intel', icon: Radar, label: 'Market' },
  { id: 'whale', icon: Fish, label: 'Whales' },
  { id: 'opportunities', icon: Sparkles, label: 'Alpha' },
  { id: 'copilot', icon: Brain, label: 'AI Coach' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'watchlists', icon: Star, label: 'Watchlist' },
]

const FOOT: { id: TerminalPane; icon: LucideIcon; label: string }[] = [
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'history', icon: History, label: 'History' },
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
      className={`group relative flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-all duration-[var(--tit-motion)] ease-[var(--tit-ease)] ${
        active
          ? 'bg-[rgba(37,99,235,0.1)] text-[var(--tit-accent)]'
          : 'text-[var(--tit-text-1)] hover:translate-x-0.5 hover:bg-black/[0.03] hover:text-[var(--tit-text-0)]'
      }`}
    >
      {active ? (
        <span
          className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r bg-[var(--tit-accent)]"
          aria-hidden
        />
      ) : null}
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} />
      <span className="truncate text-[0.875rem] font-semibold tracking-[-0.01em]">{label}</span>
    </button>
  )
}

/** Spec sidebar — 260px branded rail with labels. */
export function IconRail({ active, onSelect }: Props) {
  const { isConnected, shortAddr, walletAddress } = useSolana()
  const railActive =
    active === 'discover'
      ? 'opportunities'
      : active === 'coach'
        ? 'charts'
        : active

  return (
    <nav
      className="tit-area-rail flex flex-col border-r border-[var(--tit-border)] bg-white px-3 py-5"
      style={{ width: 'var(--tit-icon-rail)' }}
      aria-label="Terminal panes"
    >
      <div className="mb-7 flex items-center gap-3 px-2">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[rgba(37,99,235,0.1)] text-[0.75rem] font-bold text-[var(--tit-accent)]"
          aria-hidden
        >
          CC
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.875rem] font-bold tracking-tight text-[var(--tit-text-0)]">
            CryptoCheck AI
          </p>
          <p className="truncate text-[0.6875rem] font-medium text-[var(--tit-text-2)]">
            AI Trading Terminal
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {MAIN.map((item) => (
          <RailButton
            key={item.id}
            {...item}
            active={
              railActive === item.id ||
              (item.id === 'alerts' && active === 'intel') ||
              (item.id === 'charts' && active === 'coach')
            }
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-[var(--tit-border)] pt-3">
        {FOOT.map((item) => (
          <RailButton key={item.id} {...item} active={active === item.id} onSelect={onSelect} />
        ))}

        <div className="mt-3 space-y-2 rounded-[18px] border border-[var(--tit-border)] bg-[var(--tit-bg-1)] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(37,99,235,0.12)] text-[0.625rem] font-bold text-[var(--tit-accent)]">
              {isConnected && (shortAddr || walletAddress)
                ? (shortAddr || walletAddress).slice(0, 2).toUpperCase()
                : 'CC'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.75rem] font-semibold text-[var(--tit-text-0)]">
                {isConnected && shortAddr ? shortAddr : 'Wallet'}
              </p>
              <p className="flex items-center gap-1 text-[0.625rem] font-semibold text-[var(--tit-accent)]">
                <Wallet className="h-3 w-3" strokeWidth={2} />
                {isConnected ? 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[0.625rem] font-semibold text-[var(--tit-text-2)]">
            <span>Subscription</span>
            <span className="text-[var(--tit-accent)]">Pro</span>
          </div>
          <div className="flex items-center justify-between text-[0.625rem] font-semibold text-[var(--tit-text-2)]">
            <span>Chains</span>
            <span className="text-[var(--tit-text-0)]">Solana</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
