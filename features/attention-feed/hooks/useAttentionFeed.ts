'use client'

/**
 * Composes read-only adapters over existing Pro Mode hooks/providers.
 * No duplicate engines — reshape only. Live holdings (not mocks).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useTopTokens, useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { summaryFromHoldings } from '@/features/terminal-os/portfolio-os/lib/summary-from-holdings'
import { useTerminalOsStore } from '@/stores/terminal-os'
import type { HoldingsResponse } from '@/types/portfolio-desk'
import type { CoachInsight, PortfolioHealthSummary } from '@/features/terminal-os/shared/types'
import { adaptDecisionToAttention } from '../adapters/decision-adapter'
import { adaptWhalesToAttention } from '../adapters/whale-adapter'
import { adaptMarketToAttention } from '../adapters/market-adapter'
import { adaptCoachToAttention, adaptPortfolioToAttention } from '../adapters/coach-portfolio-adapter'
import { adaptDnaToAttention } from '../adapters/dna-adapter'
import { prioritizeAttentionItems } from '../lib/prioritize'
import { filterWorkspaceItems } from '../lib/filter-workspace'
import type { SimpleWorkspaceId } from '../lib/vocab'
import type { AttentionItem } from '../types'

export function useAttentionFeed(workspace: SimpleWorkspaceId = 'home'): {
  items: AttentionItem[]
  allItems: AttentionItem[]
  isLoading: boolean
  isError: boolean
} {
  const { state, narrative } = useTradeLikeMeEngine()
  const whalesQ = useWhaleMovements(16)
  const tokensQ = useTopTokens('solana')
  const wallet = useTerminalOsStore((s) => s.walletAddress)
  const walletConnected = useTerminalOsStore((s) => s.walletConnected)
  const chainFamily = useTerminalOsStore((s) => s.walletChainFamily)

  const [portfolio, setPortfolio] = useState<PortfolioHealthSummary | null>(null)
  const [coachInsights, setCoachInsights] = useState<CoachInsight[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!walletConnected || !wallet || chainFamily === 'evm') {
      setPortfolio(null)
      setCoachInsights([])
      return
    }
    setPortfolioLoading(true)
    void fetch(`/api/portfolio/holdings?wallet=${encodeURIComponent(wallet)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('holdings')
        return (await res.json()) as HoldingsResponse
      })
      .then((h) => {
        if (!cancelled) setPortfolio(summaryFromHoldings(h))
      })
      .catch(() => {
        if (!cancelled) setPortfolio(null)
      })
      .finally(() => {
        if (!cancelled) setPortfolioLoading(false)
      })

    void fetch(`/api/terminal-os/coach?wallet=${encodeURIComponent(wallet)}`)
      .then(async (res) => {
        if (!res.ok) return
        const body = (await res.json()) as { insights?: CoachInsight[]; insufficientData?: boolean }
        if (!cancelled && body.insights?.length && !body.insufficientData) {
          setCoachInsights(body.insights)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [walletConnected, wallet, chainFamily])

  const allItems = useMemo(() => {
    const merged: AttentionItem[] = [
      ...adaptDecisionToAttention(state, narrative),
      ...adaptDnaToAttention(state.dna),
      ...adaptWhalesToAttention(whalesQ.data ?? []),
      ...adaptMarketToAttention(tokensQ.data ?? []),
      ...adaptCoachToAttention(coachInsights),
      ...(portfolio ? adaptPortfolioToAttention(portfolio) : []),
    ]
    return prioritizeAttentionItems(merged, 12)
  }, [state, narrative, whalesQ.data, tokensQ.data, coachInsights, portfolio])

  const items = useMemo(
    () => filterWorkspaceItems(allItems, workspace),
    [allItems, workspace],
  )

  const isLoading =
    (whalesQ.isLoading && !whalesQ.data) ||
    (tokensQ.isLoading && !tokensQ.data) ||
    portfolioLoading

  const isError = Boolean(whalesQ.isError && tokensQ.isError)

  return { items, allItems, isLoading, isError }
}
