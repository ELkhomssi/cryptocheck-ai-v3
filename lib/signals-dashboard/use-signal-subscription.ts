'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SignalFeedFilter } from '@cryptocheck/signal-contracts'
import { SIGNAL_COMPLIANCE } from '@cryptocheck/signal-contracts'

type SubscriptionState = {
  tier: 'free' | 'premium'
  authenticated: boolean
  userId?: string
  merchantWallet?: string
  priceUsd?: number
  paymentMemo?: string
}

export function useSignalSubscription() {
  const [sub, setSub] = useState<SubscriptionState>({
    tier: 'free',
    authenticated: false,
  })
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/signals/subscription', { cache: 'no-store' })
      const body = (await res.json()) as SubscriptionState & {
        merchantWallet?: string
        priceUsd?: number
      }
      setSub({
        tier: body.tier ?? 'free',
        authenticated: body.authenticated === true,
        userId: body.userId,
        merchantWallet: body.merchantWallet,
        priceUsd: body.priceUsd,
        paymentMemo: body.userId ? `signals_premium:${body.userId}` : undefined,
      })
    } catch {
      setSub({ tier: 'free', authenticated: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { sub, loading, reload, compliance: SIGNAL_COMPLIANCE }
}
