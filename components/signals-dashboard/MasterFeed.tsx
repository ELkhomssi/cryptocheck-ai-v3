'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { SignalFeedFilter, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { ConnectionPill } from '@/components/command-center/ConnectionPill'
import { FeedErrorCard } from '@/components/command-center/FeedErrorCard'
import { useSignalFeed } from '@/lib/signals-dashboard/use-signal-feed'
import { useSignalSubscription } from '@/lib/signals-dashboard/use-signal-subscription'
import { SignalFeedFilters } from './SignalFeedFilters'
import { MasterFeedVirtualList } from './MasterFeedVirtualList'
import { SignalSwapSheet } from './SignalSwapSheet'
import { SignalsPremiumCard } from './SignalsPremiumCard'

export function MasterFeed() {
  const searchParams = useSearchParams()
  const deepMint = searchParams.get('mint')?.trim()
  const deepSignalId = searchParams.get('signalId')?.trim()

  const [filter, setFilter] = useState<SignalFeedFilter>({})
  const { sub, reload: reloadSub, compliance } = useSignalSubscription()

  const premiumToken =
    typeof process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN === 'string'
      ? process.env.NEXT_PUBLIC_SIGNAL_PREMIUM_TOKEN
      : undefined

  const { signals, orderedIds, tier, connection, loading, degraded, recentIds, setPaused, reload } =
    useSignalFeed(filter, { userId: sub.userId, premiumToken })

  const [swapSignal, setSwapSignal] = useState<UnifiedSignal | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const openSwap = useCallback((signal: UnifiedSignal) => {
    if (signal.subjectType !== 'token') return
    setSwapSignal(signal)
    setSheetOpen(true)
  }, [])

  useEffect(() => {
    if (!deepMint || !signals.size) return
    const match =
      [...signals.values()].find((s) => s.id === deepSignalId) ??
      [...signals.values()].find((s) => s.contractAddress === deepMint)
    if (match) {
      setSwapSignal(match)
      setSheetOpen(true)
    }
  }, [deepMint, deepSignalId, signals])

  const onUpgraded = useCallback(async () => {
    await reloadSub()
    void reload()
  }, [reloadSub, reload])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-lime">
            Live intelligence
          </p>
          <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
            Master Feed
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-rd-mid">
            {compliance.signalLabel}. {compliance.disclaimer}
          </p>
          <p className="mt-1 max-w-2xl text-xs text-rd-lo">{compliance.sportsLabel}</p>
        </div>
        <ConnectionPill
          state={connection}
          tier={tier}
          delayLabel={tier === 'free' ? '90s delay' : 'realtime'}
        />
      </header>

      <SignalsPremiumCard
        tier={sub.tier}
        authenticated={sub.authenticated}
        merchantWallet={sub.merchantWallet}
        priceUsd={sub.priceUsd}
        paymentMemo={sub.paymentMemo}
        onUpgraded={() => void onUpgraded()}
      />

      <SignalFeedFilters filter={filter} onChange={setFilter} tier={tier} />

      {degraded && connection !== 'live' ? (
        <FeedErrorCard onRetry={() => void reload()} />
      ) : null}

      <MasterFeedVirtualList
        signals={signals}
        orderedIds={orderedIds}
        recentIds={recentIds}
        onSwap={openSwap}
        onPauseChange={setPaused}
        loading={loading}
      />

      <footer className="text-xs text-rd-lo">
        <a href={compliance.termsPath} className="underline hover:text-rd-mid">
          Terms
        </a>
        {' · '}
        <a href={compliance.feeDisclosurePath} className="underline hover:text-rd-mid">
          Fee disclosure
        </a>
      </footer>

      <SignalSwapSheet signal={swapSignal} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
