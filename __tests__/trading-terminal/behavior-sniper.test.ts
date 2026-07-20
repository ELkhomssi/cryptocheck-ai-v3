import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { detectBehaviorPatterns } from '@/lib/trading-terminal/behavior'
import { parseTradeLog, type TerminalTradeEntry } from '@/lib/trading-terminal/trade-log'
import { canArmSniper, parseSniperState } from '@/lib/trading-terminal/sniper-state'
import type { OverrideLogEntry } from '@/lib/trading-terminal/coach-interrupt'

const MINT = 'So11111111111111111111111111111111111111112'
const MINT2 = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

function trade(over: Partial<TerminalTradeEntry>): TerminalTradeEntry {
  return {
    at: '2026-07-21T12:00:00.000Z',
    mint: MINT,
    symbol: 'SOL',
    side: 'buy',
    signature: 'sig'.padEnd(64, '1'),
    verdictAtTrade: 'SAFE',
    coachOverridden: false,
    ...over,
  }
}

describe('parseTradeLog', () => {
  it('rejects short signatures', () => {
    assert.equal(
      parseTradeLog(
        JSON.stringify([{ at: 'x', mint: MINT, side: 'buy', signature: 'short', symbol: 'S' }]),
      ).length,
      0,
    )
  })

  it('parses valid rows', () => {
    const rows = parseTradeLog(JSON.stringify([trade({})]))
    assert.equal(rows.length, 1)
  })
})

describe('detectBehaviorPatterns', () => {
  it('empty inputs → no findings', () => {
    assert.deepEqual(detectBehaviorPatterns({ trades: [], overrides: [] }), [])
  })

  it('flags override cluster', () => {
    const now = Date.parse('2026-07-21T18:00:00.000Z')
    const overrides: OverrideLogEntry[] = [1, 2, 3].map((n) => ({
      at: new Date(now - n * 60_000).toISOString(),
      mint: MINT,
      side: 'buy',
      triggers: ['high_risk'],
      action: 'overridden',
      verdict: 'HIGH_RISK',
    }))
    const f = detectBehaviorPatterns({ trades: [], overrides, now })
    assert.ok(f.some((x) => x.id === 'override_cluster'))
  })

  it('flags whiplash flips', () => {
    const now = Date.parse('2026-07-21T18:00:00.000Z')
    const trades = [
      trade({
        at: new Date(now - 30_000).toISOString(),
        side: 'sell',
        signature: 'a'.padEnd(64, 'a'),
      }),
      trade({
        at: new Date(now - 60_000).toISOString(),
        side: 'buy',
        signature: 'b'.padEnd(64, 'b'),
      }),
      trade({
        at: new Date(now - 90_000).toISOString(),
        side: 'sell',
        mint: MINT2,
        signature: 'c'.padEnd(64, 'c'),
      }),
      trade({
        at: new Date(now - 100_000).toISOString(),
        side: 'buy',
        mint: MINT2,
        signature: 'd'.padEnd(64, 'd'),
      }),
    ]
    const f = detectBehaviorPatterns({ trades, overrides: [], now })
    assert.ok(f.some((x) => x.id === 'whiplash_flip'))
  })

  it('flags ignored warning streak', () => {
    const trades = [
      trade({
        coachOverridden: true,
        verdictAtTrade: 'HIGH_RISK',
        signature: 'e'.padEnd(64, 'e'),
      }),
      trade({
        coachOverridden: true,
        verdictAtTrade: 'CAUTION',
        signature: 'f'.padEnd(64, 'f'),
        at: '2026-07-21T11:00:00.000Z',
      }),
    ]
    const f = detectBehaviorPatterns({ trades, overrides: [] })
    assert.ok(f.some((x) => x.id === 'ignored_warning_streak'))
  })
})

describe('canArmSniper', () => {
  it('requires ack and mint', () => {
    const r = canArmSniper({
      mint: '',
      riskScore: 20,
      verdict: 'SAFE',
      maxRiskScore: 70,
      riskAck: false,
      maxSol: 1,
    })
    assert.equal(r.ok, false)
  })

  it('blocks BLOCKED verdict', () => {
    const r = canArmSniper({
      mint: MINT,
      riskScore: 90,
      verdict: 'BLOCKED',
      maxRiskScore: 70,
      riskAck: true,
      maxSol: 1,
    })
    assert.equal(r.ok, false)
  })

  it('arms when safe', () => {
    const r = canArmSniper({
      mint: MINT,
      riskScore: 20,
      verdict: 'SAFE',
      maxRiskScore: 70,
      riskAck: true,
      maxSol: 0.5,
    })
    assert.equal(r.ok, true)
  })
})

describe('parseSniperState', () => {
  it('defaults on null', () => {
    const s = parseSniperState(null)
    assert.equal(s.armed, false)
    assert.equal(s.maxSol, 1)
  })
})
