import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PERSONAL_WATCH_INTERVAL_MIN,
  PERSONAL_WATCH_PREMIUM_INTERVAL_SEC,
  WATCH_FREE_DELAY_MS,
} from '@/lib/personal-watch/constants'
import {
  applyFreeTierWatchDelay,
  buildWatchUpsellCopy,
  estimateRealUpsellSave,
} from '@/lib/personal-watch/coach-delay'
import type { WatchDegradeEvent } from '@/lib/personal-watch/constants'

const sampleEvent = (overrides: Partial<WatchDegradeEvent> = {}): WatchDegradeEvent => ({
  id: 'e1',
  userId: 'u1',
  mint: 'Mint1111111111111111111111111111111111111',
  prevVerdict: 'SAFE',
  newVerdict: 'DANGER',
  prevRisk: 20,
  newRisk: 85,
  reason: 'Mint authority re-activated',
  held: true,
  ts: new Date().toISOString(),
  ...overrides,
})

describe('premium watch intervals', () => {
  it('premium interval is meaningfully faster than free cron', () => {
    const freeSec = PERSONAL_WATCH_INTERVAL_MIN * 60
    assert.ok(PERSONAL_WATCH_PREMIUM_INTERVAL_SEC < freeSec)
    assert.ok(PERSONAL_WATCH_PREMIUM_INTERVAL_SEC >= 30)
    assert.ok(PERSONAL_WATCH_PREMIUM_INTERVAL_SEC <= 60)
  })

  it('free alert delay matches Alpha Feed default (90s)', () => {
    assert.equal(WATCH_FREE_DELAY_MS, 90_000)
  })
})

describe('free-tier watch delay + upsell', () => {
  it('free tier hides recent held DANGER as blurred teaser', () => {
    const recent = sampleEvent({ ts: new Date().toISOString() })
    const { alerts, delayedTeaser } = applyFreeTierWatchDelay([recent], 'free')
    assert.equal(alerts.length, 0)
    assert.ok(delayedTeaser?.blurred)
    assert.ok(delayedTeaser?.delayed)
  })

  it('premium tier sees alerts immediately', () => {
    const recent = sampleEvent({ ts: new Date().toISOString() })
    const { alerts, delayedTeaser } = applyFreeTierWatchDelay([recent], 'premium')
    assert.equal(alerts.length, 1)
    assert.equal(delayedTeaser, null)
  })

  it('upsell copy references real held event', () => {
    const copy = buildWatchUpsellCopy(sampleEvent({ held: true, newVerdict: 'DANGER' }))
    assert.match(copy, /you hold/)
    assert.match(copy, /DANGER/)
  })

  it('save estimate is null without real prices', () => {
    assert.equal(
      estimateRealUpsellSave({ positionValueUsd: 100, priceAtAlert: null, priceAtGrade: 0.5 }),
      null,
    )
  })

  it('save estimate uses real position × price delta only', () => {
    const est = estimateRealUpsellSave({
      positionValueUsd: 200,
      priceAtAlert: 1,
      priceAtGrade: 0.2,
    })
    assert.equal(est, 160)
  })
})

describe('guardian auth message', () => {
  it('includes non-custodial standing instruction language', async () => {
    const { buildGuardianAuthMessage } = await import('@/lib/personal-watch/guardian-auth')
    const msg = buildGuardianAuthMessage({
      userId: 'u1',
      wallet: 'Wallet111111111111111111111111111111111111',
      mint: '*',
      maxSlippageBps: 150,
      minProceedsRatio: 0.85,
      nonce: 'n1',
      expiresAt: new Date().toISOString(),
    })
    assert.match(msg, /sign each exit/)
    assert.match(msg, /no silent background/i)
  })
})
