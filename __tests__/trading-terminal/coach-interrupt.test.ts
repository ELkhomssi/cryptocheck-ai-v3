import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ScanResult } from '@/lib/revenue-dashboard/types'
import {
  evaluateCoachInterrupts,
  hasHardBlock,
  hasSoftGate,
} from '@/lib/trading-terminal/coach-interrupt'

const MINT = 'So11111111111111111111111111111111111111112'

function scan(over: Partial<ScanResult> = {}): ScanResult {
  return {
    mint: MINT,
    symbol: 'SOL',
    name: 'Solana',
    safetyScore: 80,
    riskScore: 20,
    verdict: 'SAFE',
    confidence: 'high',
    topSignals: [{ id: 'a', label: 'LP locked', weight: 10, detail: 'ok' }],
    evidenceLine: 'ok',
    scannedAt: '2026-07-20T00:00:00.000Z',
    cache: 'miss',
    sample: false,
    ...over,
  }
}

describe('evaluateCoachInterrupts', () => {
  it('SAFE buy → no interrupts', () => {
    const i = evaluateCoachInterrupts({
      scan: scan(),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.equal(i.length, 0)
  })

  it('DANGER risk≥80 → hard BLOCKED, no soft needed', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'DANGER', riskScore: 88, safetyScore: 12 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.ok(hasHardBlock(i))
    assert.equal(i[0]!.id, 'blocked')
    assert.equal(i[0]!.blocksSubmit, true)
  })

  it('DANGER risk<80 buy → soft HIGH_RISK', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'DANGER', riskScore: 70, safetyScore: 30 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.ok(hasSoftGate(i))
    assert.equal(i.some((x) => x.id === 'high_risk'), true)
    assert.equal(hasHardBlock(i), false)
  })

  it('sell side skips high_risk / caution gates', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'DANGER', riskScore: 70 }),
      ticketSide: 'sell',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.equal(i.some((x) => x.id === 'high_risk'), false)
  })

  it('respects soft mute', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'DANGER', riskScore: 70 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: { high_risk: Date.now() + 60_000 },
      now: Date.now(),
    })
    assert.equal(i.some((x) => x.id === 'high_risk'), false)
  })

  it('cannot mute away hard block', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'DANGER', riskScore: 90 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: { blocked: Date.now() + 60_000 },
      now: Date.now(),
    })
    assert.ok(hasHardBlock(i))
  })

  it('concentration ≥35% on buy', () => {
    const i = evaluateCoachInterrupts({
      scan: scan(),
      ticketSide: 'buy',
      positionConcentrationPct: 40,
      muted: {},
    })
    assert.equal(i.some((x) => x.id === 'concentration'), true)
  })

  it('sample tag always soft-gates', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ sample: true }),
      ticketSide: 'sell',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.equal(i.some((x) => x.id === 'sample_data'), true)
  })

  it('low caution riskScore does not soft-gate', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'CAUTION', riskScore: 30, safetyScore: 55 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.equal(i.some((x) => x.id === 'caution_buy'), false)
  })

  it('caution riskScore≥50 soft-gates buy', () => {
    const i = evaluateCoachInterrupts({
      scan: scan({ verdict: 'CAUTION', riskScore: 55, safetyScore: 50 }),
      ticketSide: 'buy',
      positionConcentrationPct: null,
      muted: {},
    })
    assert.equal(i.some((x) => x.id === 'caution_buy'), true)
  })
})
