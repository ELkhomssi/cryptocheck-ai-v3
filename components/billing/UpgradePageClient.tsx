'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Syncopate } from 'next/font/google'
import { ANNUAL_SAVINGS_BADGE_PCT, PLANS } from '@/lib/billing/upgrade-plans'
import type { BillingCycle, UpgradePlanId } from '@/lib/billing/upgrade-plans'

const syncopate = Syncopate({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-syncopate' })

export function UpgradePageClient() {
  const searchParams = useSearchParams()
  const checkout = searchParams.get('checkout')
  const [cycle, setCycle] = useState<BillingCycle>('annual')
  const [loading, setLoading] = useState<UpgradePlanId | null>(null)
  const [txStatus, setTxStatus] = useState<string | null>(
    checkout === 'success'
      ? 'Payment received — full access activates after Stripe confirms (usually under a minute).'
      : checkout === 'cancel'
        ? 'Checkout canceled. No charge was made.'
        : null,
  )
  const [txStatusIsError, setTxStatusIsError] = useState(checkout === 'cancel')

  const handlePayWithCard = useCallback(async (planId: UpgradePlanId) => {
    setLoading(planId)
    setTxStatus(null)
    setTxStatusIsError(false)
    try {
      const { supabase } = await import('@/lib/supabase')
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setTxStatus('Sign in to continue — your purchase is attached to your account.')
        setTxStatusIsError(true)
        return
      }

      const res = await fetch('/api/billing/upgrade-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, cycle }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout')
      }
      window.location.href = data.url
    } catch (e: unknown) {
      setTxStatus(e instanceof Error ? e.message : 'Could not start checkout. Please try again.')
      setTxStatusIsError(true)
    } finally {
      setLoading(null)
    }
  }, [cycle])

  return (
    <div
      className={`${syncopate.variable} min-h-screen flex items-center justify-center p-4`}
      style={{
        background: '#020408',
        fontFamily: "'IBM Plex Mono', 'JetBrains Mono', monospace",
      }}
    >
      <div
        className="w-full max-w-[720px] rounded-2xl overflow-hidden"
        style={{
          background: '#0a0e14',
          border: '1px solid rgba(0,212,170,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div className="text-center px-5 pt-8 pb-5 relative">
          <Link
            href="/app"
            className="absolute top-4 right-4 text-[#484f58] hover:text-[#8b949e] no-underline text-xl leading-none"
            aria-label="Back to app"
          >
            &times;
          </Link>
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-2xl mb-3"
            style={{
              border: '1px solid rgba(0,212,170,0.2)',
              background: 'rgba(0,212,170,0.05)',
            }}
          >
            <span
              className="text-[8px] font-bold tracking-[0.1em]"
              style={{ color: '#00d4aa', fontFamily: 'var(--font-syncopate), sans-serif' }}
            >
              INSTITUTIONAL ACCESS
            </span>
          </div>
          <h1
            className="text-2xl md:text-[26px] font-extrabold text-white m-0 mb-1.5"
            style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
          >
            Upgrade to <span style={{ color: '#00d4aa' }}>PRO</span>
          </h1>
          <p className="text-xs text-[#6e7681] m-0">
            Secure checkout via Stripe — instant access after payment.
          </p>
        </div>

        {txStatus && (
          <div
            className="mx-5 mb-3 px-3.5 py-2.5 rounded-lg text-[11px] font-semibold flex items-start gap-2.5 leading-snug"
            style={{
              background: txStatusIsError ? 'rgba(251,191,36,0.08)' : 'rgba(0,212,170,0.06)',
              border: txStatusIsError ? '1px solid rgba(251,191,36,0.35)' : '1px solid rgba(0,212,170,0.15)',
              color: txStatusIsError ? '#fcd34d' : '#00d4aa',
            }}
          >
            {txStatusIsError && <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden />}
            <span className="flex-1">{txStatus}</span>
          </div>
        )}

        {/* Billing-cycle toggle */}
        <div className="flex justify-center px-5 pb-4">
          <div
            className="inline-flex items-center gap-1 rounded-full p-1"
            style={{ border: '1px solid rgba(0,212,170,0.15)', background: 'rgba(0,212,170,0.04)' }}
          >
            {(['monthly', 'annual'] as BillingCycle[]).map((c) => {
              const active = cycle === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold tracking-wide transition-colors"
                  style={{
                    background: active ? '#00d4aa' : 'transparent',
                    color: active ? '#04120e' : '#8b949e',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {c === 'monthly' ? 'Monthly' : 'Annual'}
                  {c === 'annual' ? (
                    <span
                      className="rounded px-1.5 py-0.5 text-[8px] font-bold"
                      style={{
                        background: active ? 'rgba(4,18,14,0.18)' : 'rgba(0,212,170,0.15)',
                        color: active ? '#04120e' : '#00d4aa',
                      }}
                    >
                      SAVE {ANNUAL_SAVINGS_BADGE_PCT}%
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2-column plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-5 pb-4 max-w-[560px] mx-auto">
          {PLANS.map((pl) => {
            const recommended = !!pl.bestValue
            const amount = pl.cycles[cycle].amountUsd
            const periodLabel = cycle === 'annual' ? '/ year' : '/ month'
            return (
              <div
                key={pl.id}
                className="relative rounded-xl"
                style={{
                  background: '#0d1420',
                  border: recommended
                    ? '1px solid rgba(0,212,170,0.42)'
                    : '1px solid rgba(0,212,170,0.08)',
                  boxShadow: recommended ? '0 0 28px rgba(0,212,170,0.12), inset 0 1px 0 rgba(0,212,170,0.05)' : undefined,
                }}
              >
                {recommended && (
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-[2] text-[8px] font-bold px-2.5 py-0.5 rounded-[10px] whitespace-nowrap tracking-[0.06em]"
                    style={{
                      background: '#00d4aa',
                      color: '#0a0a0a',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    }}
                  >
                    BEST VALUE
                  </div>
                )}
                <div className="p-5 pt-6 text-center">
                  <div
                    className="text-[11px] font-semibold text-[#8b949e] mb-1 uppercase tracking-[0.08em]"
                    style={{ fontFamily: 'var(--font-syncopate), sans-serif' }}
                  >
                    {pl.name}
                  </div>
                  <div className="text-[28px] font-extrabold text-white leading-none mb-1">${amount}</div>
                  <div className="text-[11px] text-[#484f58] mb-1">{periodLabel}</div>
                  {cycle === 'annual' ? (
                    <div className="text-[10px] font-bold mb-4" style={{ color: '#00d4aa' }}>
                      Save {ANNUAL_SAVINGS_BADGE_PCT}% vs monthly
                    </div>
                  ) : (
                    <div className="mb-4" />
                  )}
                  <button
                    type="button"
                    onClick={() => void handlePayWithCard(pl.id)}
                    disabled={loading === pl.id}
                    className="w-full py-3 rounded-lg text-xs font-bold tracking-wide transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: '#00d4aa',
                      color: '#04120e',
                      border: 'none',
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {loading === pl.id ? 'Redirecting…' : 'Pay with Card'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Full-access line */}
        <p
          className="text-center text-[11px] text-[#8b949e] leading-relaxed px-5 pb-5 m-0 max-w-[640px] mx-auto"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          All plans include full access to the entire platform: Deep Neural Scans, Alpha Feed, and AI
          Auto-Sniper.
        </p>

        {/* Compliance */}
        <div
          className="px-5 py-3 text-center border-t text-[9px] text-[#484f58] leading-relaxed"
          style={{ borderColor: 'rgba(255,255,255,0.04)' }}
        >
          <span>Not financial advice · DYOR</span>
          <span className="mx-2 text-[#303030]">|</span>
          <Link href="/terms" className="text-[#6e7681] hover:text-[#00d4aa] no-underline">
            Terms
          </Link>
          <span className="mx-1">·</span>
          <Link href="/terms#fees" className="text-[#6e7681] hover:text-[#00d4aa] no-underline">
            Fee disclosure
          </Link>
        </div>
      </div>
    </div>
  )
}
