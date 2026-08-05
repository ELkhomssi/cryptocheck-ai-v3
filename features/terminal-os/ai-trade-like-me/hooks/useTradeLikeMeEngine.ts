'use client'

/**
 * Client hook — UI reads state; orchestrator owns business logic.
 * Train uses real connected wallet + on-chain signature capture (read-only).
 */

import { useCallback, useEffect, useRef, useState, startTransition } from 'react'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { explainDecision } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import { liveMarketDataProvider, liveWhaleFeedProvider } from '@/features/terminal-os/shared/lib/live-providers'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { ExplainedNarrative } from '@/features/terminal-os/ai-trade-like-me/engines/explainable-engine'
import type { CapturedTrade, TradeLikeMeState, TraderDna } from '@/features/terminal-os/ai-trade-like-me/types'

export function useTradeLikeMeEngine() {
  const flags = useTerminalOsStore((s) => s.featureFlags)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletAddress = useTerminalOsStore((s) => s.walletAddress)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
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

  // Clear TLM when wallet disconnects or switches
  useEffect(() => {
    if (!walletConnected) {
      orchRef.current.resetSession()
      startTransition(() => sync())
      return
    }
    const current = orchRef.current.getState(flags).wallet
    if (current && walletAddress && current !== walletAddress) {
      orchRef.current.resetSession()
      startTransition(() => sync())
    }
  }, [walletConnected, walletAddress, flags, sync])

  // Hydrate DNA from Redis when wallet connects (survives reload)
  useEffect(() => {
    if (!walletConnected || !walletAddress) return
    let cancelled = false
    void fetch(`/api/terminal-os/dna?wallet=${encodeURIComponent(walletAddress)}`)
      .then((r) => r.json())
      .then((body: { dna?: TraderDna | null }) => {
        if (cancelled || !body.dna || body.dna.wallet !== walletAddress) return
        if (body.dna.sampleSize < 1) return
        orchRef.current.dnaEngine.hydrate(body.dna)
        // Mark behavioral wallet so getState.wallet matches for coach
        orchRef.current.behavioral.hydrate([], walletAddress)
        startTransition(() => sync())
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [walletConnected, walletAddress, sync])

  const persistDna = useCallback(async () => {
    const dna = orchRef.current.dnaEngine.getDna()
    if (!dna || dna.sampleSize < 1) return
    await fetch('/api/terminal-os/dna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dna }),
    })
  }, [])

  const trainAiFromMyTrading = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      if (!walletConnected || !walletAddress) {
        throw new Error('Connect a wallet first (read-only) to start learning.')
      }
      if (walletChainFamily === 'evm') {
        throw new Error('Trade Like Me capture is Solana-first — connect a Solana wallet.')
      }

      const histRes = await fetch(
        `/api/terminal-os/trade-history?wallet=${encodeURIComponent(walletAddress)}`,
      )
      const histBody = (await histRes.json()) as {
        trades?: CapturedTrade[]
        error?: string
        meta?: { insufficient?: boolean; reason?: string; closedRounds?: number }
      }
      if (!histRes.ok) {
        throw new Error(histBody.error ?? histBody.meta?.reason ?? 'Failed to capture on-chain history')
      }
      const seeds = histBody.trades ?? []
      if (histBody.meta?.insufficient || seeds.filter((t) => t.pnlPct != null).length < 3) {
        throw new Error(
          histBody.meta?.reason ??
            'Not enough closed priced trades yet — DNA needs real fills (entry/exit/PnL), not signatures.',
        )
      }
      orchRef.current.trainFromWallet(walletAddress, seeds)
      // Force DNA rebuild even below min samples so coach has a wallet-specific profile
      orchRef.current.refreshDna()
      await persistDna()
      startTransition(() => sync())

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
  }, [walletConnected, walletAddress, walletChainFamily, chain, flags, sync, persistDna])

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
