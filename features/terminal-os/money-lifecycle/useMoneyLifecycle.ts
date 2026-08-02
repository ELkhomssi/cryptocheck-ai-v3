'use client'

/**
 * Aggregates live engine outputs for the Money Lifecycle ribbon.
 * Decision Stage 5 reads the shared server Decision store — identical object as Discovery/Coach/Alerts.
 */

import { useEffect, useMemo, useState, startTransition } from 'react'
import type { Decision } from '@cryptocheck/decision-contracts'
import { useTerminalOsStore } from '@/stores/terminal-os'
import { getTradeLikeMeOrchestrator } from '@/features/terminal-os/ai-trade-like-me/engines/orchestrator'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import type {
  MarketContext,
  PerformanceReport,
  TraderDna,
} from '@/features/terminal-os/ai-trade-like-me/types'
import { deriveLifecycle } from './derive-lifecycle'
import { useExecutionLifecycleBridge } from './execution-lifecycle-bridge'
import { resolveRampConfig } from './ramp-links'
import type { LifecycleDerived, LifecycleSnapshot } from './types'

type TlmSlice = {
  dna: TraderDna | null
  performance: PerformanceReport | null
  marketContext: MarketContext | null
}

function readTlmSlice(): TlmSlice {
  const orch = getTradeLikeMeOrchestrator()
  const flags = useTerminalOsStore.getState().featureFlags
  const state = orch.getState(flags)
  return {
    dna: state.dna,
    performance: state.performance,
    marketContext: orch.getLastMarketContext(),
  }
}

export function useMoneyLifecycle(): {
  derived: LifecycleDerived
  snapshot: LifecycleSnapshot
} {
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const walletAddress = useTerminalOsStore((s) => s.walletAddress)
  const walletBalances = useTerminalOsStore((s) => s.walletBalances)
  const walletChainFamily = useTerminalOsStore((s) => s.walletChainFamily)
  const focused = useTerminalOsStore((s) => s.focusedToken)
  const executionState = useExecutionLifecycleBridge((s) => s.executionState)

  const [tlm, setTlm] = useState<TlmSlice>(() => readTlmSlice())
  const [decision, setDecision] = useState<Decision | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioHealthSummary | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [availableSol, setAvailableSol] = useState<number | null>(null)

  useEffect(() => {
    const sync = () => startTransition(() => setTlm(readTlmSlice()))
    sync()
    const unsub = getTradeLikeMeOrchestrator().bus.subscribe('*', sync)
    const id = window.setInterval(sync, 2_500)
    return () => {
      unsub()
      window.clearInterval(id)
    }
  }, [walletConnected, walletAddress])

  useEffect(() => {
    let cancelled = false
    const loadDecision = async () => {
      try {
        const qs = new URLSearchParams({ limit: '8' })
        if (walletAddress) qs.set('wallet', walletAddress)
        if (focused?.id) qs.set('token', focused.id)
        const res = await fetch(`/api/terminal-os/decisions?${qs}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('decisions')
        const body = (await res.json()) as {
          decision?: Decision | null
          decisions?: Decision[]
        }
        if (cancelled) return
        setDecision(body.decision ?? body.decisions?.[0] ?? null)
      } catch {
        if (!cancelled) setDecision(null)
      }
    }
    void loadDecision()
    const id = window.setInterval(() => void loadDecision(), 20_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [walletAddress, focused?.id])

  useEffect(() => {
    let cancelled = false
    if (!walletConnected || !walletAddress || walletChainFamily === 'evm') {
      setPortfolio(null)
      setAvailableSol(null)
      setPortfolioLoading(false)
      return
    }
    setPortfolioLoading(true)
    void fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(walletAddress)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('holdings')
        return (await res.json()) as HoldingsResponse
      })
      .then((h) => {
        if (cancelled) return
        setPortfolio(summaryFromHoldings(h))
        setAvailableSol(h.availableSol)
      })
      .catch(() => {
        if (!cancelled) {
          setPortfolio(null)
          setAvailableSol(null)
        }
      })
      .finally(() => {
        if (!cancelled) setPortfolioLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [walletConnected, walletAddress, walletChainFamily])

  const cashReadyUsd = walletBalances?.totalValueUsd ?? portfolio?.totalAssetsUsd ?? null
  const ramp = useMemo(() => resolveRampConfig(walletAddress), [walletAddress])

  const snapshot: LifecycleSnapshot = useMemo(
    () => ({
      walletConnected,
      walletAddress,
      cashReadyUsd,
      availableSol,
      portfolio,
      portfolioLoading,
      dna: tlm.dna,
      marketContext: tlm.marketContext,
      decision,
      executionState,
      performance: tlm.performance,
      ramp,
    }),
    [
      walletConnected,
      walletAddress,
      cashReadyUsd,
      availableSol,
      portfolio,
      portfolioLoading,
      tlm,
      decision,
      executionState,
      ramp,
    ],
  )

  const derived = useMemo(() => deriveLifecycle(snapshot), [snapshot])

  return { derived, snapshot }
}
