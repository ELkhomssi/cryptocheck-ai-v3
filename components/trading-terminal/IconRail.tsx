'use client'

import type { LucideIcon } from 'lucide-react'
import { Bell, Brain, LayoutDashboard, Settings, Star } from 'lucide-react'
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

const PRIMARY: { id: TerminalPane; icon: LucideIcon; label: string }[] = [
  { id: 'portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'watchlists', icon: Star, label: 'Watchlist' },
  { id: 'alerts', icon: Bell, label: 'Alerts' },
  { id: 'copilot', icon: Brain, label: 'AI Coach' },
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
      className={`tit-rail-item${active ? ' is-active' : ''}`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 1.85 : 1.55} />
      <span>{label}</span>
    </button>
  )
}

/** Picture-1 sidebar: Portfolio · Watchlist · Alerts · AI Coach · Settings. */
export function IconRail({ active, onSelect }: Props) {
  const { isConnected, shortAddr, walletAddress } = useSolana()
  const railActive =
    active === 'coach' || active === 'copilot'
      ? 'copilot'
      : active === 'discover'
        ? 'opportunities'
        : active

  const initials =
    isConnected && (shortAddr || walletAddress)
      ? (shortAddr || walletAddress).slice(0, 2)
      : 'CC'

  return (
    <nav className="tit-area-rail tit-rail flex flex-col" aria-label="Terminal panes">
      <div className="tit-rail-brand">
        <div className="tit-rail-mark" aria-hidden />
        <div>
          <div className="tit-rail-name">
            CRYPTO<em>CHECK</em> AI
          </div>
          <div className="tit-rail-sub">TRADING TERMINAL</div>
        </div>
      </div>

      <div className="tit-rail-nav">
        {PRIMARY.map((item) => (
          <RailButton
            key={item.id}
            {...item}
            active={railActive === item.id}
            onSelect={onSelect}
          />
        ))}

        <div className="tit-rail-label">SYSTEM</div>
        <RailButton
          id="settings"
          icon={Settings}
          label="Settings"
          active={railActive === 'settings'}
          onSelect={onSelect}
        />
      </div>

      <div className="tit-rail-foot">
        <div className="tit-rail-avatar" aria-hidden>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="tit-rail-foot-name truncate">
            {isConnected && shortAddr ? shortAddr : 'Guest'}
          </div>
          <div className="tit-rail-foot-plan">◆ Pro Plan</div>
        </div>
      </div>
    </nav>
  )
}
