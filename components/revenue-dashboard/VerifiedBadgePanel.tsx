'use client'

import { useCallback, useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { PayWidget } from '@/components/payments/PayWidget'
import { RevenueComplianceNote } from './RevenueComplianceNote'
import {
  VERIFIED_BADGE_PRICE_USD,
  badgeEmbedSnippet,
} from '@/lib/revenue-dashboard/constants'
import type { VerifiedBadgeSnapshot, VerifiedBadgeOrder } from '@/lib/revenue-dashboard/types'

const PAY_RULE =
  'Payment buys a fresh scan and embeddable badge only. A honeypot that pays still gets a red DANGER badge — verdict is never for sale.'

export function VerifiedBadgePanel() {
  const [mint, setMint] = useState('')
  const [order, setOrder] = useState<VerifiedBadgeOrder | null>(null)
  const [badge, setBadge] = useState<VerifiedBadgeSnapshot | null>(null)
  const [embed, setEmbed] = useState('')
  const [loading, setLoading] = useState(false)
  const [fulfilling, setFulfilling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrder = useCallback(async () => {
    const m = mint.trim()
    if (m.length < 32) {
      setError('Enter a valid Solana mint.')
      return
    }
    setError(null)
    setLoading(true)
    setBadge(null)
    setEmbed('')
    try {
      const res = await fetch('/api/revenue/badge/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mint: m }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not create order')
      setOrder(json.order as VerifiedBadgeOrder)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }, [mint])

  const onPaid = useCallback(
    async (result: { signature: string; intentId: string }) => {
      if (!order) return
      setFulfilling(true)
      setError(null)
      try {
        const res = await fetch('/api/revenue/badge/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id, intentId: result.intentId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Fulfillment failed')
        const snap = json.badge as VerifiedBadgeSnapshot
        setBadge(snap)
        setEmbed(badgeEmbedSnippet(snap.mint, window.location.origin))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Fulfillment failed')
      } finally {
        setFulfilling(false)
      }
    },
    [order],
  )

  return (
    <div className="space-y-6">
      <header>
        <p className="font-rd-display text-[0.62rem] font-bold uppercase tracking-[0.2em] text-rd-violet">
          Verified badge
        </p>
        <h2 className="mt-1 font-rd-display text-xl font-bold uppercase tracking-[0.06em] text-rd-hi md:text-2xl">
          Pay to be scanned
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-rd-mid">{PAY_RULE}</p>
      </header>

      <div className="rd-panel border-rd-violet/25 p-4">
        <p className="rd-label">Token mint</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value.trim())}
            placeholder="Project token mint…"
            className="min-w-0 flex-1 rounded-rd-sm border border-white/10 bg-rd-navy/80 px-3 py-2.5 font-rd-mono text-sm text-rd-hi"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => void createOrder()}
            disabled={loading || fulfilling}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-rd-sm bg-rd-violet px-4 py-2.5 font-rd-display text-[0.62rem] font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <Shield className="h-4 w-4" />}
            Create order · ${VERIFIED_BADGE_PRICE_USD}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rd-danger" role="alert">
          {error}
        </p>
      ) : null}

      {fulfilling ? (
        <div className="rd-panel flex items-center gap-2 p-4 text-sm text-rd-mid">
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" />
          Running independent gateway scan…
        </div>
      ) : null}

      {order && !badge ? (
        <div className="space-y-3">
          <p className="text-sm text-rd-mid">
            Order <span className="font-rd-mono text-rd-hi">{order.id}</span> · pay via CCAI Pay (risk-checked, non-custodial).
          </p>
          <PayWidget
            wallet={order.merchantWallet}
            merchantName="CryptoCheck Verified Badge"
            defaultAmountUsd={order.amountUsd}
            defaultToken="USDC"
            memo={`badge:${order.id}`}
            onSuccess={(r) => void onPaid(r)}
          />
        </div>
      ) : null}

      {badge ? (
        <div className="space-y-4">
          <article className="rd-panel p-5">
            <p className="rd-label">Current verdict (live from gateway)</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span
                className={`font-rd-display text-lg font-bold uppercase ${
                  badge.verdict === 'SAFE'
                    ? 'text-rd-safe'
                    : badge.verdict === 'CAUTION'
                      ? 'text-rd-caution'
                      : 'text-rd-danger'
                }`}
              >
                {badge.verdict}
              </span>
              <span className="font-rd-mono text-2xl tabular-nums text-rd-hi">{badge.safetyScore}/100</span>
            </div>
            <p className="mt-2 text-xs text-rd-lo">Scanned {new Date(badge.scannedAt).toLocaleString()}</p>
            <a href={badge.reportUrl} className="mt-3 inline-block text-sm text-rd-violet underline">
              Full report →
            </a>
          </article>

          <article className="rd-panel p-4">
            <p className="rd-label mb-2">Embed snippet</p>
            <pre className="overflow-x-auto rounded-rd-sm border border-white/10 bg-rd-navy/90 p-3 font-rd-mono text-[0.65rem] text-rd-mid">
              {embed}
            </pre>
            <p className="mt-2 text-xs text-rd-lo">
              Or iframe:{' '}
              <code className="text-rd-mid">{`/embed/badge/${badge.mint}`}</code>
            </p>
          </article>

          <div className="rd-panel p-4">
            <p className="rd-label mb-2">Preview</p>
            <iframe
              title="Badge preview"
              src={`/embed/badge/${encodeURIComponent(badge.mint)}`}
              className="h-[88px] w-full max-w-[320px] rounded-rd-sm border border-white/10 bg-transparent"
            />
          </div>
        </div>
      ) : null}

      <RevenueComplianceNote />
    </div>
  )
}
