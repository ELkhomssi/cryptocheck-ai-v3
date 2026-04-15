'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

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

  if (!me) return <p className="text-zinc-500">Loading…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono text-2xl font-semibold text-white">Billing</h1>
        <p className="mt-1 text-sm text-zinc-500">Stripe subscription, invoices, and upgrades.</p>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-xs uppercase text-zinc-500">Current plan</p>
          <p className="mt-2 font-mono text-xl text-white">{me.subscription.effectiveTier}</p>
          <p className="mt-1 text-sm text-zinc-500">
            Status: {me.subscription.status ?? '—'}
            {me.subscription.currentPeriodEnd && (
              <>
                {' '}
                · Renews / ends: {new Date(me.subscription.currentPeriodEnd).toLocaleDateString()}
              </>
            )}
          </p>
          {me.subscription.cancelAtPeriodEnd && (
            <p className="mt-2 text-sm text-amber-400">Cancels at period end.</p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-white/[0.08] p-5">
          <button
            type="button"
            onClick={() => void upgrade('pro')}
            className="rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Upgrade to Pro
          </button>
          <button
            type="button"
            onClick={() => void upgrade('enterprise')}
            className="rounded-lg border border-white/[0.12] py-2.5 text-sm text-white hover:bg-white/[0.04]"
          >
            Upgrade to Enterprise
          </button>
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={!me.subscription.stripeCustomerId}
            className="text-sm text-zinc-400 underline decoration-zinc-600 hover:text-white disabled:opacity-40"
          >
            Manage subscription & invoices (Stripe portal)
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
      <BillingInner />
    </Suspense>
  )
}
