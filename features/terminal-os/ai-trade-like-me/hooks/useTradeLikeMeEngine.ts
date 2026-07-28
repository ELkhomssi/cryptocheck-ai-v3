'use client'

/**
 * Client hook — UI reads state; orchestrator owns business logic.
 */

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { buildSampleTradeHistory } from '@/features/terminal-os/ai-trade-like-me/lib/sample-trade-history'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { liveMarketDataProvider, liveWhaleFeedProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ExplainedNarrative } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { TradeLikeMeState } from '@/features/terminal-os/ai-trade-like-me/types'

export function useTradeLikeMeEngine() {
  const flags = useTerminalOsStore((s) => s.featureFlags)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletLabel = useTerminalOsStore((s) => s.walletLabel)
  const setWalletConnected = useTerminalOsStore((s) => s.setWalletConnected)
  const chain = useTerminalOsStore((s) => s.tokenChainTab)

  const orchRef = useRef(getTradeLikeMeOrchestrator())
  const [state, setState] = useState<TradeLikeMeState>(() => orchRef.current.getState(flags))
  const [narrative, setNarrative] = useState<ExplainedNarrative | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(() => {
    const next = orchRef.current.getState(flags)
    setState(next)
    if (next.currentOpportunity) {
      setNarrative(explainDecision(next.currentOpportunity))
    }
  }, [flags])

  useEffect(() => {
    sync()
  }, [sync])

  const trainAiFromMyTrading = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      let wallet = walletLabel
      if (!walletConnected || !wallet) {
        // Request wallet permission (terminal wallet connect — non-custodial label)
        wallet = '7a8x…TrainAI'
        setWalletConnected(true, wallet)
      }
      const fullWallet = wallet.length < 32 ? `Train${wallet.replace(/[^a-zA-Z0-9]/g, '')}Sol111111111111111111111111` : wallet
      // Seed with tagged sample history until on-chain indexer lands
      const seeds = buildSampleTradeHistory(fullWallet)
      orchRef.current.trainFromWallet(fullWallet, seeds)
      startTransition(() => sync())

      // Immediately score a live opportunity
      const [tokens, whales] = await Promise.all([
        liveMarketDataProvider.getTopTokens(chain === 'all' ? 'solana' : chain),
        liveWhaleFeedProvider.getRecentMovements(16),
      ])
      if (tokens[0]) {
        orchRef.current.evaluateOpportunity(tokens[0], whales, flags)
      }
      startTransition(() => sync())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Training failed')
    } finally {
      setBusy(false)
    }
  }, [walletConnected, walletLabel, setWalletConnected, chain, flags, sync])

  const refreshOpportunity = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const [tokens, whales] = await Promise.all([
        liveMarketDataProvider.getTopTokens(chain === 'all' ? 'solana' : chain),
        liveWhaleFeedProvider.getRecentMovements(16),
      ])
      if (!tokens[0]) throw new Error('No live market opportunity')
      orchRef.current.evaluateOpportunity(tokens[0], whales, flags, {
        hasOpenPosition: Boolean(orchRef.current.getState(flags).openPosition),
      })
      startTransition(() => sync())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opportunity refresh failed')
    } finally {
      setBusy(false)
    }
  }, [chain, flags, sync])

  const teach = useCallback(
    (note: string) => {
      orchRef.current.teach(note)
      void fetch('/api/terminal-os/trade-like-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'teach', note }),
      })
      sync()
    },
    [sync],
  )

  const setAutonomyEnabled = useCallback(
    (enabled: boolean) => {
      orchRef.current.updateAutonomyConfig({ enabled })
      sync()
    },
    [sync],
  )

  const setCollectiveConsent = useCallback(
    (optedIn: boolean) => {
      orchRef.current.setCollectiveConsent(optedIn)
      sync()
    },
    [sync],
  )

  return {
    state,
    narrative,
    busy,
    error,
    trainAiFromMyTrading,
    refreshOpportunity,
    teach,
    setAutonomyEnabled,
    setCollectiveConsent,
    flags,
  }
}
