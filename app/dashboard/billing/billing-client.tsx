'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/Dashboard/GlassCard'
import { DeveloperPricingGrid } from '@/components/billing/DeveloperPricingGrid'
import type { DeveloperTier } from '@/lib/config/developer-pricing'
import type { BillingStripeUrls } from '@/lib/config/billing-stripe-urls'

export type { BillingStripeUrls }

type Me = {
  subscription: {
    effectiveTier: string
    runtimeTier: string
    status: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    stripeCustomerId: string | null
  }
}

function appendStripeLinkParams(baseUrl: string, userId: string | null, email: string | null) {
  let url = baseUrl.trim()
  if (!url) return url
  const q = new URLSearchParams()
  if (userId) q.set('client_reference_id', userId)
  if (email) q.set('prefilled_email', email)
  const qs = q.toString()
  if (!qs) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${qs}`
}

function BillingInner({ stripeUrls }: { stripeUrls: BillingStripeUrls }) {
  const sp = useSearchParams()
  const checkout = sp.get('checkout')
  const [me, setMe] = useState<Me | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const fiatEnabled = process.env.NEXT_PUBLIC_ENABLE_FIAT_PAYMENTS === 'true'
  const [redirectingTier, setRedirectingTier] = useState<string | null>(null)

  const load = useCallback(() => {
    void fetch('/api/dashboard/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.subscription) setMe({ subscription: j.subscription })
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (checkout === 'success') setMsg('Payment successful — your plan will update within a minute.')
    if (checkout === 'cancel') setMsg('Checkout canceled.')
  }, [checkout])

  async function openPortal() {
    setMsg(null)
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      credentials: 'include',
    })
    const j = await res.json().catch(() => ({}))
    if (j.url) window.location.href = j.url
    else setMsg(typeof j.error === 'string' && j.error ? 'Billing unavailable' : 'Portal unavailable (subscribe to a paid plan first).')
  }

  async function redirectToPaymentLink(rawUrl: string, tierKey: string) {
    if (!rawUrl?.trim()) {
      setMsg('Checkout link is not configured.')
      return
    }
    setMsg(null)
    setRedirectingTier(tierKey)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? null
      const email = session?.user?.email ?? null
      window.location.href = appendStripeLinkParams(rawUrl, uid, email)
    } finally {
      setRedirectingTier(null)
    }
  }

  async function handleStripeBuy(tier: DeveloperTier) {
    const url = tier.id === 'enterprise' ? stripeUrls.enterprise : stripeUrls.proDeveloper
    await redirectToPaymentLink(url, tier.id)
  }

  if (!me) {
    return <p className="text-sm font-medium tracking-wide text-slate-500">Loading subscription…</p>
  }

  const sentinel = ['PRO', 'ENTERPRISE'].includes(me.subscription.effectiveTier.toUpperCase())

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Commercial</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-200">Subscription &amp; billing</h1>
        <p className="mt-2 text-sm font-medium text-slate-400">
          API access, dashboard, and support — priced for developers and institutions.
        </p>
      </header>

      {msg && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-200/95">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6">
          <GlassCard accent={sentinel ? 'sentinel' : 'default'} className="p-6">
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-500">Active plan</p>
            <p className="mt-3 text-xl font-semibold tabular-nums text-slate-200">{me.subscription.effectiveTier}</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Status: {me.subscription.status ?? '—'}
              {me.subscription.effectiveTier.toUpperCase() === 'FREE' && (
                <>
                  {' '}
                  · API calls today: 0 / 100
                </>
              )}
              {me.subscription.currentPeriodEnd && (
                <>
                  {' '}
                  · Renews / ends: {new Date(me.subscription.currentPeriodEnd).toLocaleDateString()}
                </>
              )}
            </p>
            {me.subscription.cancelAtPeriodEnd && (
              <p className="mt-3 text-sm font-medium text-amber-200/90">Cancels at period end.</p>
            )}
          </GlassCard>
        </div>
        {fiatEnabled && (
          <div className="col-span-12 md:col-span-6">
            <GlassCard className="p-6">
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={!me.subscription.stripeCustomerId}
                className="w-full text-left text-sm font-medium text-slate-500 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-300 disabled:opacity-40"
              >
                Manage subscription &amp; invoices (Stripe portal)
              </button>
            </GlassCard>
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Upgrade</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-200">Upgrade your plan</h2>
        </div>
        <DeveloperPricingGrid
          currentTier={me.subscription.effectiveTier}
          stripeUrls={stripeUrls}
          redirectingTierId={redirectingTier}
          onStripeBuy={(tier) => void handleStripeBuy(tier)}
        />
      </section>
    </div>
  )
}

export function BillingClient({ stripeUrls }: { stripeUrls: BillingStripeUrls }) {
  return (
    <Suspense fallback={<p className="text-sm font-medium text-slate-500">Loading…</p>}>
      <BillingInner stripeUrls={stripeUrls} />
    </Suspense>
  )
}
