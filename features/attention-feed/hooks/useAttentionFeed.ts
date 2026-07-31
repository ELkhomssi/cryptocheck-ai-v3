'use client'

/**
 * Composes read-only adapters over existing Pro Mode hooks/providers.
 * No duplicate engines — reshape only.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTradeLikeMeEngine } from '@/features/terminal-os/ai-trade-like-me/hooks/useTradeLikeMeEngine'
import { useTopTokens, useWhaleMovements } from '@/features/terminal-os/shared/hooks/useTerminalQueries'
import { mockAiCoachProvider, mockPortfolioOsProvider } from '@/features/terminal-os/shared/lib/mock-providers'
import { adaptDecisionToAttention } from '../adapters/decision-adapter'
import { adaptWhalesToAttention } from '../adapters/whale-adapter'
import { adaptMarketToAttention } from '../adapters/market-adapter'
import { adaptCoachToAttention, adaptPortfolioToAttention } from '../adapters/coach-portfolio-adapter'
import { prioritizeAttentionItems } from '../lib/prioritize'
import type { AttentionItem } from '../types'

export function useAttentionFeed(): {
  items: AttentionItem[]
  isLoading: boolean
  isError: boolean
} {
  const { state, narrative } = useTradeLikeMeEngine()
  const whalesQ = useWhaleMovements(16)
  const tokensQ = useTopTokens('solana')

  const coachQ = useQuery({
    queryKey: ['attention', 'coach'],
    queryFn: () => mockAiCoachProvider.getInsights(),
    staleTime: 60_000,
  })

  const portfolioQ = useQuery({
    queryKey: ['attention', 'portfolio'],
    queryFn: () => mockPortfolioOsProvider.getHealthSummary(),
    staleTime: 60_000,
  })

  const items = useMemo(() => {
    const merged: AttentionItem[] = [
      ...adaptDecisionToAttention(state, narrative),
      ...adaptWhalesToAttention(whalesQ.data ?? []),
      ...adaptMarketToAttention(tokensQ.data ?? []),
      ...adaptCoachToAttention(coachQ.data ?? []),
      ...(portfolioQ.data ? adaptPortfolioToAttention(portfolioQ.data) : []),
    ]
    return prioritizeAttentionItems(merged, 7)
  }, [state, narrative, whalesQ.data, tokensQ.data, coachQ.data, portfolioQ.data])

  const isLoading =
    (whalesQ.isLoading && !whalesQ.data) ||
    (tokensQ.isLoading && !tokensQ.data) ||
    (coachQ.isLoading && !coachQ.data) ||
    (portfolioQ.isLoading && !portfolioQ.data)

  const isError = Boolean(whalesQ.isError && tokensQ.isError)

  return { items, isLoading, isError }
}
