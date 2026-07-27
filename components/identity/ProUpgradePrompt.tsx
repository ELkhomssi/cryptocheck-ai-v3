'use client'

/**
 * Phase 18 — contextual Pro upsell. Never shown mid-briefing.
 * Only render when a gated action was attempted (parent controls visibility).
 */

import { FEATURE_UNLOCK_COPY, type EntitlementFeature } from '@/lib/identity/entitlements-copy'

export function ProUpgradePrompt({
  feature,
  onDismiss,
  showManageBilling = false,
}: {
  feature: EntitlementFeature
  onDismiss?: () => void
  showManageBilling?: boolean
}) {
  const startCheckout = async () => {
    const res = await fetch('/api/billing/pro-checkout', { method: 'POST' })
    const body = (await res.json()) as { url?: string; error?: string }
    if (body.url) {
      window.location.href = body.url
      return
    }
    alert(body.error || 'Checkout unavailable')
  }

  const openPortal = async () => {
    const res = await fetch('/api/billing/pro-portal', { method: 'POST' })
    const body = (await res.json()) as { url?: string; error?: string }
    if (body.url) {
      window.location.href = body.url
      return
    }
    alert(body.error || 'Billing portal unavailable')
  }

  return (
    <div className="mc-upsell" role="dialog" aria-label="Upgrade to Pro">
      <p className="mc-upsell-copy">{FEATURE_UNLOCK_COPY[feature]}</p>
      <div className="mc-upsell-actions">
        <button type="button" className="mc-upsell-primary" onClick={() => void startCheckout()}>
          Upgrade to Pro
        </button>
        {showManageBilling ? (
          <button type="button" className="mc-talk-quiet-link" onClick={() => void openPortal()}>
            Manage billing
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" className="mc-talk-quiet-link" onClick={onDismiss}>
            Not now
          </button>
        ) : null}
      </div>
    </div>
  )
}
