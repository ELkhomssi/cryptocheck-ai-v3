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
import { CapitalRotationPanel } from './CapitalRotationPanel'
import { DecisionActions } from './DecisionActions'
import { IntelligenceSwap } from './IntelligenceSwap'
import { MarketIntelligence } from './MarketIntelligence'
import { TodaysRecommendation } from './TodaysRecommendation'
import '../styles.css'

export function AiOsShell() {
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const focusedToken = useTerminalOsStore((s) => s.focusedToken)
  const { briefing, loading, reload } = useOsBriefing(wallet)
  const [intent, setIntent] = useState<OsIntentId | null>(null)
  const coachRef = useRef<HTMLDivElement | null>(null)
  const swapRef = useRef<HTMLDivElement | null>(null)
  const [approvedBuyMint, setApprovedBuyMint] = useState<string | null>(null)
  const [approvedBuySymbol, setApprovedBuySymbol] = useState<string | null>(null)
  const [approvedSellMint, setApprovedSellMint] = useState<string | null>(null)
  const [approvedSellSymbol, setApprovedSellSymbol] = useState<string | null>(null)

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

        {(intent === 'protect' || intent === 'monitor' || intent === 'invest' || wallet) && (
          <CapitalRotationPanel
            onRotateInto={(legs) => {
              setApprovedSellMint(legs.exitMint)
              setApprovedSellSymbol(legs.exitSymbol)
              setApprovedBuyMint(legs.entryMint)
              setApprovedBuySymbol(legs.entrySymbol)
              swapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          />
        )}

        <div ref={swapRef}>
          <IntelligenceSwap
            initialSellMint={approvedSellMint}
            initialSellSymbol={approvedSellSymbol}
            initialBuyMint={approvedBuyMint ?? focusedToken?.id ?? briefing?.recommendation?.symbol}
            initialBuySymbol={approvedBuySymbol ?? focusedToken?.symbol ?? briefing?.recommendation?.symbol}
            onSwapConfirmed={(info) => {
              if (info.side !== 'buy' || !wallet) return
              void fetch('/api/terminal-os/rotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  wallet,
                  action: 'record_entry_fill',
                  entryMint: info.mint,
                }),
              }).catch(() => {
                /* optional — cost basis may be unavailable */
              })
            }}
          />
        </div>

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

        <DecisionActions
          briefing={briefing}
          intent={intent}
          onTaught={() => void reload()}
          onApprove={(mint, symbol) => {
            setApprovedSellMint(null)
            setApprovedSellSymbol(null)
            setApprovedBuyMint(mint)
            setApprovedBuySymbol(symbol)
            swapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </div>
    </div>
  )
}
