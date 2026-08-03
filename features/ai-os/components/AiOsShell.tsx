'use client'

/**
 * CryptoCheck AI — single AI Operating System shell.
 * Portfolio → AI Gateway → Mission Feed → Coach → History.
 * Mission Control is a status drawer. No Simple/Pro split.
 */

import { useCallback, useRef, useState } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useOsMission, useOsPortfolio } from '../hooks/useOsData'
import { AiOsWalletBar } from './AiOsWalletBar'
import { AiCoachAssistant } from './AiCoachAssistant'
import { AiGateway } from './AiGateway'
import { HistoryAnalytics } from './HistoryAnalytics'
import { MissionControlDrawer } from './MissionControlDrawer'
import { MissionFeed } from './MissionFeed'
import { PortfolioSummary } from './PortfolioSummary'
import '../styles.css'

export function AiOsShell() {
  const portfolio = useOsPortfolio()
  const mission = useOsMission()
  const { state } = useTradeLikeMeEngine()
  const dnaReady = Boolean(state.dna && state.dna.sampleSize >= 3)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [coachPrompt, setCoachPrompt] = useState<string | null>(null)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const coachRef = useRef<HTMLDivElement | null>(null)

  const askCoach = useCallback((prompt: string) => {
    setCoachPrompt(prompt)
    coachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const openHistory = useCallback(() => {
    setHistoryOpen(true)
    requestAnimationFrame(() => {
      historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  return (
    <div data-aios>
      <div className="aios-ambient" aria-hidden />

      <header className="aios-top">
        <div className="aios-brand">
          <button
            type="button"
            className="aios-mc-btn"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open Mission Control"
          >
            <span className="aios-mc-btn-bars" aria-hidden />
            Mission Control
          </button>
          <div>
            <p className="aios-brand-name">CryptoCheck AI</p>
            <p className="aios-brand-sub">Operating System</p>
          </div>
        </div>
        <AiOsWalletBar />
      </header>

      <main className="aios-main">
        <PortfolioSummary
          connected={portfolio.connected}
          summary={portfolio.summary}
          worst={portfolio.worst}
          loading={portfolio.loading}
          onOpenHistory={openHistory}
        />

        <AiGateway
          mission={mission.mission}
          loading={mission.missionLoading}
          summary={portfolio.summary}
          worst={portfolio.worst}
          onAskCoach={askCoach}
        />

        <MissionFeed events={mission.timeline} loading={mission.timelineLoading} />

        <div ref={coachRef}>
          <AiCoachAssistant
            pendingPrompt={coachPrompt}
            onPromptConsumed={() => setCoachPrompt(null)}
          />
        </div>

        <div ref={historyRef}>
          <HistoryAnalytics
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
            summary={portfolio.summary}
            holdings={portfolio.holdings ?? null}
          />
        </div>
      </main>

      <MissionControlDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        modules={mission.modules}
        mission={mission.mission}
        dnaReady={dnaReady}
        overallHealth={mission.overallHealth}
      />
    </div>
  )
}
