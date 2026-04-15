'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GlassCard } from '@/components/Dashboard/GlassCard'

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

function BillingInner() {
  const sp = useSearchParams()
  const checkout = sp.get('checkout')
  const [me, setMe] = useState<Me | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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
    if (checkout === 'success') setMsg('Payment successful — subscription will sync within a minute.')
    if (checkout === 'cancel') setMsg('Checkout canceled.')
  }, [checkout])

  async function upgrade(plan: 'pro' | 'enterprise') {
    setMsg(null)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const j = await res.json().catch(() => ({}))
    if (j.url) window.location.href = j.url
    else setMsg(j.error || 'Could not start checkout')
  }

  async function openPortal() {
    setMsg(null)
    const res = await fetch('/api/billing/portal', {
      method: 'POST',
      credentials: 'include',
    })
    const j = await res.json().catch(() => ({}))
    if (j.url) window.location.href = j.url
    else setMsg(j.error || 'Portal unavailable (subscribe to a paid plan first).')
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
          Stripe-backed contracts, invoices, and upgrades — aligned to intelligence throughput.
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
        <div className="col-span-12 flex flex-col justify-center gap-3 md:col-span-6">
          <GlassCard className="p-6">
            <button
              type="button"
              onClick={() => void upgrade('pro')}
              className="w-full rounded-lg border border-emerald-500/35 bg-emerald-500/15 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-500/25"
            >
              Upgrade to Pro
            </button>
            <button
              type="button"
              onClick={() => void upgrade('enterprise')}
              className="mt-3 w-full rounded-lg border border-white/[0.1] py-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-slate-200 transition-all duration-150 ease-out hover:border-white/[0.14] hover:bg-white/[0.04]"
            >
              Upgrade to Enterprise
            </button>
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={!me.subscription.stripeCustomerId}
              className="mt-4 w-full text-left text-sm font-medium text-slate-500 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-slate-300 disabled:opacity-40"
            >
              Manage subscription & invoices (Stripe portal)
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-sm font-medium text-slate-500">Loading…</p>}>
      <BillingInner />
    </Suspense>
  )
}
