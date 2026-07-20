import type { SignalSubscriptionTier } from '@cryptocheck/signal-contracts'
import {
  WATCH_FREE_DELAY_MS,
  type CoachAlertView,
  type WatchDegradeEvent,
} from './constants'

export function buildWatchUpsellCopy(event: WatchDegradeEvent): string {
  const held = event.held ? 'you hold' : 'you watch'
  return `A token ${held} was just flagged ${event.newVerdict}. Premium users get instant alerts and can auto-exit —`
}

export function applyFreeTierWatchDelay(
  alerts: WatchDegradeEvent[],
  tier: SignalSubscriptionTier,
): {
  alerts: CoachAlertView[]
  delayedTeaser: CoachAlertView | null
  upgradeHint: string | null
} {
  if (tier === 'premium') {
    return { alerts, delayedTeaser: null, upgradeHint: null }
  }

  const cutoff = Date.now() - WATCH_FREE_DELAY_MS
  const visible: CoachAlertView[] = []
  let delayedTeaser: CoachAlertView | null = null

  for (const a of alerts) {
    const ts = Date.parse(a.ts)
    if (ts <= cutoff) {
      visible.push(a)
      continue
    }
    if (!delayedTeaser && a.held && a.newVerdict === 'DANGER') {
      delayedTeaser = { ...a, blurred: true, delayed: true }
    }
  }

  const upgradeHint = delayedTeaser
    ? `${buildWatchUpsellCopy(delayedTeaser)} Upgrade for instant alerts + Guardian Auto-Exit.`
    : 'Watch alerts + Guardian Auto-Exit are premium — upgrade for instant DANGER detection on tokens you hold.'

  return { alerts: visible, delayedTeaser, upgradeHint }
}

/**
 * Real savings estimate only when we have position value at alert time.
 * Never fabricate — returns null when inputs missing.
 */
export function estimateRealUpsellSave(input: {
  positionValueUsd: number | null
  priceAtAlert: number | null
  priceAtGrade: number | null
}): number | null {
  const { positionValueUsd, priceAtAlert, priceAtGrade } = input
  if (
    positionValueUsd == null ||
    priceAtAlert == null ||
    priceAtGrade == null ||
    !Number.isFinite(positionValueUsd) ||
    !Number.isFinite(priceAtAlert) ||
    !Number.isFinite(priceAtGrade) ||
    priceAtAlert <= 0 ||
    priceAtGrade >= priceAtAlert
  ) {
    return null
  }
  const drawdown = (priceAtAlert - priceAtGrade) / priceAtAlert
  return Math.round(positionValueUsd * drawdown * 100) / 100
}
