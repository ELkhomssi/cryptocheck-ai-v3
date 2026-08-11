/**
 * Crash-hardening for Terminal OS formatters + holdings summary.
 * Run: node --import tsx --test __tests__/terminal-os/crash-hardening.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatPct, formatUsd } from '../../features/terminal-os/shared/lib/format'
import { summaryFromHoldings } from '../../features/terminal-os/portfolio-os/lib/summary-from-holdings'
import { heroReason, engineChecklist } from '../../features/ai-os/lib/gateway-round2'
import type { Decision } from '@cryptocheck/decision-contracts'
import type { HoldingsResponse } from '../../types/portfolio-desk'

const root = process.cwd()

describe('Terminal OS crash hardening', () => {
  it('formatPct / formatUsd never throw on non-finite input', () => {
    assert.equal(formatPct(undefined as unknown as number), '0.00%')
    assert.equal(formatPct(Number.NaN), '0.00%')
    assert.match(formatUsd(undefined as unknown as number), /\$0/)
    assert.match(formatUsd(Number.NaN, true), /\$0/)
  })

  it('summaryFromHoldings tolerates missing holdings array', () => {
    const s = summaryFromHoldings({} as HoldingsResponse)
    assert.equal(s.totalAssetsUsd, 0)
    assert.equal(Number.isFinite(s.diversificationScore), true)
  })

  it('heroReason never throws on null reasoning (prod Decision shape)', () => {
    assert.equal(heroReason(null), '')
    assert.equal(heroReason(undefined), '')
  })

  it('engineChecklist never throws when contributingFactors missing', () => {
    const d = {
      id: 'x',
      subject: { kind: 'token', symbol: 'SOL', address: 'So111', chain: 'solana' },
      action: 'BUY',
      confidence: 50,
      marketConfidence: 50,
      confidenceMode: 'market',
      reasoning: null,
      risk: 20,
      computedAt: '2026-08-11T00:00:00.000Z',
      staleAfter: '2026-08-11T00:05:00.000Z',
      degraded: false,
    } as unknown as Decision
    assert.doesNotThrow(() => engineChecklist({ decisionLoading: false, decision: d }))
  })

  it('decisions API route returns JSON on failure (no empty 500)', () => {
    const route = readFileSync(join(root, 'app/api/terminal-os/decisions/route.ts'), 'utf8')
    assert.match(route, /decisions_unavailable|catch \(err\)/)
    assert.match(route, /runDecisionTick\([^\)]*\)\.catch/)
  })

  it('SystemStatusGauges normalizes providers array from API', () => {
    const src = readFileSync(
      join(root, 'features/terminal-os/shell/components/SystemStatusGauges.tsx'),
      'utf8',
    )
    assert.match(src, /Array\.isArray\(rawProviders\)/)
  })
})
