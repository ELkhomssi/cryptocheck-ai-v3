'use client'

/**
 * CryptoCheck AI — AI Operating System shell.
 * Intent → Decision Engine briefing → Coach / Market / Recommendation / Actions.
 * Not a crypto dashboard.
 */

import { useEffect, useRef, useState } from 'react'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { useOsBriefing } from '../hooks/useOsBriefing'
import type { OsIntentId } from '../types'
import { AiGateway } from './AiGateway'
import { AiOsCoach } from './AiOsCoach'
import { AiOsWalletBar } from './AiOsWalletBar'
import { DecisionActions } from './DecisionActions'
import { MarketIntelligence } from './MarketIntelligence'
import { TodaysRecommendation } from './TodaysRecommendation'
import '../styles.css'

export function AiOsShell() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const { briefing, loading, reload } = useOsBriefing(wallet)
  const [intent, setIntent] = useState<OsIntentId | null>(null)
  const coachRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!intent) return
    coachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [intent])

  const market = briefing?.market ?? [
    { id: 'fear' as const, label: 'Fear', value: null, detail: null, available: false },
    { id: 'greed' as const, label: 'Greed', value: null, detail: null, available: false },
    { id: 'whales' as const, label: 'Whales', value: null, detail: null, available: false },
    { id: 'smart_money' as const, label: 'Smart Money', value: null, detail: null, available: false },
    { id: 'narrative' as const, label: 'Narrative', value: null, detail: null, available: false },
  ]

  return (
    <div data-aios>
      <div className="aios-shell">
        <header className="aios-top">
          <div className="aios-brand">
            <h1 className="aios-brand-name">CryptoCheck AI</h1>
            <p className="aios-brand-sub">AI Operating System</p>
          </div>
          <AiOsWalletBar />
        </header>

        <AiGateway selected={intent} onSelect={setIntent} />

        <div ref={coachRef}>
          <AiOsCoach briefing={briefing} loading={loading} intent={intent} />
        </div>

        <MarketIntelligence signals={market} />

        {briefing?.recommendation ? (
          <TodaysRecommendation recommendation={briefing.recommendation} />
        ) : (
          <section className="aios-section" data-delay="3">
            <p className="aios-section-label">Today&apos;s Recommendation</p>
            <p className="aios-empty">
              {loading ? 'Computing Decision…' : 'No Decision published yet.'}
            </p>
          </section>
        )}

        <DecisionActions briefing={briefing} intent={intent} onTaught={() => void reload()} />
      </div>
    </div>
  )
}
