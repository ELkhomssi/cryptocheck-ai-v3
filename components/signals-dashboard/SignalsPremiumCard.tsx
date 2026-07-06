'use client'

import { useCallback, useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { PayWidget } from '@/components/payments/PayWidget'
import { registerSignalsPush } from '@/lib/signals-dashboard/push-client'

type Props = {
  tier: 'free' | 'premium'
  authenticated: boolean
  merchantWallet?: string
  priceUsd?: number
  paymentMemo?: string
  onUpgraded: () => void
}

export function SignalsPremiumCard({
  tier,
  authenticated,
  merchantWallet,
  priceUsd,
  paymentMemo,
  onUpgraded,
}: Props) {
  const [pushLoading, setPushLoading] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const enablePush = useCallback(async () => {
    setPushLoading(true)
    setPushMsg(null)
    const result = await registerSignalsPush()
    setPushLoading(false)
    setPushMsg(result.ok ? 'Alerts enabled.' : (result.reason ?? 'Failed'))
  }, [])

  if (tier === 'premium') {
    return (
      <div className="rd-panel p-4">
        <p className="rd-label">Premium active</p>
        <p className="mt-1 text-sm text-rd-mid">Real-time feed + full filters.</p>
        <button
          type="button"
          onClick={() => void enablePush()}
          disabled={pushLoading}
          className="mt-3 inline-flex items-center gap-2 rounded-rd-sm border border-rd-green/40 px-3 py-2 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-rd-green"
        >
          {pushLoading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Bell className="h-4 w-4" />}
          Enable SAFE alerts
        </button>
        {pushMsg ? <p className="mt-2 text-xs text-rd-mid">{pushMsg}</p> : null}
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="rd-panel p-4">
        <p className="text-sm text-rd-mid">Sign in to upgrade to real-time signals.</p>
        <a href="/landing?next=%2Fdashboard%2Fsignals" className="mt-2 inline-block text-sm text-rd-green underline">
          Sign in
        </a>
      </div>
    )
  }

  if (!merchantWallet || !priceUsd || !paymentMemo) return null

  return (
    <div className="rd-panel space-y-3 p-4">
      <div>
        <p className="rd-label">Upgrade</p>
        <p className="mt-1 text-sm text-rd-mid">
          Premium: real-time feed, advanced filters, SAFE push alerts with swap deep-links.
        </p>
      </div>
      <PayWidget
        wallet={merchantWallet}
        merchantName="CryptoCheck Signals Premium"
        defaultAmountUsd={priceUsd}
        defaultToken="USDC"
        memo={paymentMemo}
        onSuccess={async (r) => {
          const res = await fetch('/api/signals/subscribe/fulfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intentId: r.intentId }),
          })
          if (res.ok) onUpgraded()
        }}
      />
    </div>
  )
}
