'use client'

/**
 * Adapts portfolio-desk Mission Control + Coach into Terminal OS nav.
 * Presentation mount only — engines/APIs unchanged.
 */

import { MissionControlPanel } from '@/components/portfolio-desk/mission/MissionControlPanel'
import { CoachPanel } from '@/components/portfolio-desk/coach/CoachPanel'
import { AiCoachingCard } from '@/features/terminal-os/ai-coach/components/AiCoachingCard'
import { PanelErrorBoundary } from '@/features/terminal-os/shared/components/PanelErrorBoundary'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { DeskNav } from '@/lib/portfolio-desk/nav'
import type { TerminalNavId } from '@/features/terminal-os/shared/types'
import type { ScreenerRow } from '@/lib/providers/types'

function deskNavToTerminal(desk: DeskNav): TerminalNavId {
  switch (desk) {
    case 'mission':
      return 'mission-control'
    case 'market':
    case 'screener':
    case 'watchlist':
      return 'market-intel'
    case 'trade':
      return 'execution'
    case 'portfolio':
      return 'portfolio'
    case 'automation':
    case 'intelligence':
    case 'employees':
      return 'ai-workforce'
    case 'feed':
    case 'alerts':
      return 'alerts'
    case 'settings':
      return 'settings'
    case 'launchlab':
      return 'discovery'
    case 'coach':
      return 'ai-coach'
    default:
      return 'mission-control'
  }
}

export function MissionControlWorkspace() {
  const setActiveNav = useTerminalOsStore((s) => s.setActiveNav)
  const setFocused = useTerminalOsStore((s) => s.setFocusedToken)

  return (
    <PanelErrorBoundary title="Mission Control">
      <div className="tos-stack" style={{ maxWidth: '72rem', margin: '0 auto', width: '100%' }}>
        <MissionControlPanel
          onOpenFeed={() => setActiveNav('alerts')}
          onOpenMarket={() => setActiveNav('market-intel')}
          onOpenDesk={(desk) => setActiveNav(deskNavToTerminal(desk))}
          onOpenCoach={() => setActiveNav('ai-coach')}
          onSelectToken={(row: ScreenerRow) => {
            setFocused({
              id: row.mint,
              symbol: row.symbol || row.mint.slice(0, 6),
              name: row.name || row.symbol || row.mint.slice(0, 6),
              chain: 'solana',
              priceUsd: row.priceUsd ?? 0,
              logoUrl: row.logoUrl,
            })
            setActiveNav('market-intel')
          }}
          onSuggestion={() => setActiveNav('market-intel')}
        />
      </div>
    </PanelErrorBoundary>
  )
}

/** Migrated portfolio CoachPanel + existing Terminal OS coaching card. */
export function AiCoachWorkspace() {
  return (
    <div
      className="tos-stack"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--tos-space-3)',
        alignItems: 'start',
      }}
    >
      <PanelErrorBoundary title="AI Coach">
        <div className="tos-panel-chrome" style={{ minHeight: 420 }}>
          <CoachPanel />
        </div>
      </PanelErrorBoundary>
      <PanelErrorBoundary title="Session Coach">
        <AiCoachingCard />
      </PanelErrorBoundary>
    </div>
  )
}
