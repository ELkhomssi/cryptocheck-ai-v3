'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { DEVELOPER_TIERS, type DeveloperTier, type DeveloperTierId } from '@/lib/config/developer-pricing'
import { Card } from '@/components/Dashboard/intelligence-terminal/primitives/Card'
import type { BillingStripeUrls } from '@/lib/config/billing-stripe-urls'

type BillingTier = 'FREE' | 'PRO' | 'ENTERPRISE' | 'pro-developer' | 'enterprise' | string | null | undefined

type DeveloperPricingGridProps = {
  currentTier?: BillingTier
  manageHref?: string
  contactSalesHref?: string
  stripeUrls: BillingStripeUrls
  redirectingTierId?: string | null
  onStripeBuy: (tier: DeveloperTier) => void
}

function normalizeTier(input: BillingTier): DeveloperTierId | 'free' {
  const raw = String(input ?? '').trim().toLowerCase()
  if (raw === 'pro' || raw === 'pro-developer' || raw === 'pro_max_deep') return 'pro-developer'
  if (raw === 'enterprise' || raw === 'pro_max_elite') return 'enterprise'
  return 'free'
}

function buildEnterpriseSalesMailto() {
  const salesEmail = 'cryptocheckai@gmail.com'
  const subject = encodeURIComponent('Enterprise inquiry - CryptoCheck AI')
  const body = encodeURIComponent(
    [
      "I'm interested in the Enterprise tier for CryptoCheck AI.",
      '',
      'Company:',
      'Website:',
      'Expected monthly API volume:',
      'Primary use case:',
      '',
      'Please share pricing, onboarding timeline, and contract options.',
    ].join('\n')
  )
  return `mailto:${salesEmail}?subject=${subject}&body=${body}`
}

export function DeveloperPricingGrid({
  currentTier,
  manageHref = '/dashboard/billing',
  contactSalesHref,
  stripeUrls,
  redirectingTierId = null,
  onStripeBuy,
}: DeveloperPricingGridProps) {
  const effectiveTier = normalizeTier(currentTier)
  const enterpriseContactHref = contactSalesHref ?? buildEnterpriseSalesMailto()
  const enterprisePayUrl = stripeUrls.enterprise?.trim()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {DEVELOPER_TIERS.map((tier) => {
        const current = effectiveTier === tier.id
        const enterpriseCard = tier.id === 'enterprise'
        const accent = enterpriseCard ? 'warning' : 'safe'

        return (
          <Card key={tier.id} accent={accent} className="h-full p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">{tier.name}</p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-slate-100">${tier.priceUsd}</span>
                  <span className="text-sm font-medium text-slate-400">/month</span>
                </div>
                {tier.id === 'enterprise' ? (
                  <p className="mt-1 text-xs font-medium text-slate-500">or custom</p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-slate-500">Billed securely via Stripe</p>
                )}
              </div>
              {current && (
                <span className="rounded-full border border-emerald-500/35 bg-emerald-500/12 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                  Current plan
                </span>
              )}
              {!current && tier.badge && (
                <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/12 px-2.5 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-fuchsia-200">
                  {tier.badge.text}
                </span>
              )}
            </div>

            <ul className="mt-5 space-y-2.5">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={2.2} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6">
              {current ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                  >
                    Current plan
                  </button>
                  <Link
                    href={manageHref}
                    className="block text-center text-xs font-medium uppercase tracking-[0.12em] text-cyan-200/90 underline decoration-cyan-500/40 underline-offset-4 transition-colors hover:text-cyan-100"
                  >
                    Manage
                  </Link>
                </div>
              ) : tier.id === 'enterprise' ? (
                <div className="space-y-2.5">
                  {enterprisePayUrl ? (
                    <button
                      type="button"
                      onClick={() => onStripeBuy(tier)}
                      disabled={redirectingTierId === tier.id}
                      className="w-full rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/14 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-100 transition-colors hover:bg-fuchsia-500/22 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {redirectingTierId === tier.id ? 'Redirecting…' : 'Buy now'}
                    </button>
                  ) : null}
                  <a
                    href={enterpriseContactHref}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-200 transition-colors hover:bg-white/[0.06]"
                  >
                    Contact sales
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStripeBuy(tier)}
                  disabled={redirectingTierId === tier.id || !stripeUrls.proDeveloper?.trim()}
                  className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/14 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {redirectingTierId === tier.id ? 'Redirecting…' : 'Buy now'}
                </button>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
