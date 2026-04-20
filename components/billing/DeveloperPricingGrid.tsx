'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { DEVELOPER_TIERS, type DeveloperTier, type DeveloperTierId } from '@/lib/config/developer-pricing'
import { Card } from '@/components/Dashboard/intelligence-terminal/primitives/Card'

type BillingTier = 'FREE' | 'PRO' | 'ENTERPRISE' | 'pro-developer' | 'enterprise' | string | null | undefined
type PayMethod = 'card' | 'sol' | 'usdc'

type DeveloperPricingGridProps = {
  currentTier?: BillingTier
  manageHref?: string
  contactSalesHref?: string
  loadingTierId?: DeveloperTierId | null
  loadingMethod?: PayMethod | null
  onPayCard?: (tier: DeveloperTier) => void
  onPaySol?: (tier: DeveloperTier) => void
  onPayUsdc?: (tier: DeveloperTier) => void
}

function normalizeTier(input: BillingTier): DeveloperTierId | 'free' {
  const raw = String(input ?? '').trim().toLowerCase()
  if (raw === 'pro' || raw === 'pro-developer') return 'pro-developer'
  if (raw === 'enterprise') return 'enterprise'
  return 'free'
}

function isLoading(tierId: DeveloperTierId, method: PayMethod, loadingTierId?: DeveloperTierId | null, loadingMethod?: PayMethod | null) {
  return loadingTierId === tierId && loadingMethod === method
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
  loadingTierId = null,
  loadingMethod = null,
  onPayCard,
  onPaySol,
  onPayUsdc,
}: DeveloperPricingGridProps) {
  const effectiveTier = normalizeTier(currentTier)
  const fiatEnabled = process.env.NEXT_PUBLIC_ENABLE_FIAT_PAYMENTS === 'true'
  const enterpriseContactHref = contactSalesHref ?? buildEnterpriseSalesMailto()

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
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Pay {tier.priceSol.toFixed(2)} SOL or {tier.priceUsdc} USDC
                  </p>
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
              ) : tier.ctaVariant === 'contact-sales' ? (
                <a
                  href={enterpriseContactHref}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/12 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-100 transition-colors hover:bg-fuchsia-500/20"
                >
                  Contact Sales
                </a>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onPayCard?.(tier)}
                    disabled={!fiatEnabled || isLoading(tier.id, 'card', loadingTierId, loadingMethod)}
                    title={!fiatEnabled ? 'Card payments coming soon' : undefined}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 disabled:cursor-not-allowed disabled:opacity-75"
                  >
                    <span className="block">Pay with Card</span>
                    {!fiatEnabled && <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-normal">Coming soon</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => onPaySol?.(tier)}
                    disabled={isLoading(tier.id, 'sol', loadingTierId, loadingMethod)}
                    className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/14 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading(tier.id, 'sol', loadingTierId, loadingMethod)
                      ? 'Processing...'
                      : `Pay ${tier.priceSol.toFixed(2)} SOL on Solana`}
                  </button>

                  <button
                    type="button"
                    onClick={() => onPayUsdc?.(tier)}
                    disabled={isLoading(tier.id, 'usdc', loadingTierId, loadingMethod)}
                    className="w-full rounded-lg border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition-colors hover:bg-cyan-500/18 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading(tier.id, 'usdc', loadingTierId, loadingMethod) ? 'Processing...' : `Pay ${tier.priceUsdc} USDC`}
                  </button>
                </div>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
