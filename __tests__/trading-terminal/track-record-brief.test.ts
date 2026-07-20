import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  parseOverrideLog,
  summarizeOverrideLog,
  type OverrideLogEntry,
} from '@/lib/trading-terminal/coach-interrupt'
import {
  briefNumberFromWeekStart,
  startOfUtcWeek,
} from '@/lib/trading-terminal/weekly-brief'

const MINT = 'So11111111111111111111111111111111111111112'

describe('parseOverrideLog', () => {
  it('returns empty for garbage', () => {
    assert.deepEqual(parseOverrideLog(null), [])
    assert.deepEqual(parseOverrideLog('{'), [])
    assert.deepEqual(parseOverrideLog('[]'), [])
  })

  it('keeps valid rows only', () => {
    const rows = parseOverrideLog(
      JSON.stringify([
        {
          at: '2026-07-20T12:00:00.000Z',
          mint: MINT,
          side: 'buy',
          triggers: ['high_risk'],
          action: 'overridden',
          verdict: 'HIGH_RISK',
        },
        { at: 'bad' },
        {
          at: '2026-07-21T12:00:00.000Z',
          mint: MINT,
          side: 'sell',
          triggers: [],
          action: 'muted',
          verdict: null,
        },
      ]),
    )
    assert.equal(rows.length, 2)
    assert.equal(rows[0]!.action, 'overridden')
    assert.equal(rows[1]!.action, 'muted')
  })
})

describe('summarizeOverrideLog', () => {
  const entries: OverrideLogEntry[] = [
    {
      at: '2026-07-14T00:00:00.000Z',
      mint: MINT,
      side: 'buy',
      triggers: ['caution_buy'],
      action: 'overridden',
      verdict: 'CAUTION',
    },
    {
      at: '2026-07-20T00:00:00.000Z',
      mint: MINT,
      side: 'buy',
      triggers: ['high_risk'],
      action: 'muted',
      verdict: 'HIGH_RISK',
    },
    {
      at: '2026-07-21T00:00:00.000Z',
      mint: MINT,
      side: 'buy',
      triggers: ['sample_data'],
      action: 'dismissed',
      verdict: 'SAFE',
    },
  ]

  it('counts all-time actions', () => {
    const s = summarizeOverrideLog(entries)
    assert.equal(s.total, 3)
    assert.equal(s.overridden, 1)
    assert.equal(s.muted, 1)
    assert.equal(s.dismissed, 1)
  })

  it('filters since week start', () => {
    const s = summarizeOverrideLog(entries, '2026-07-20T00:00:00.000Z')
    assert.equal(s.sinceCount, 2)
    assert.equal(s.sinceOverridden, 0)
  })
})

describe('weekly brief helpers', () => {
  it('startOfUtcWeek lands on Monday', () => {
    // 2026-07-22 is Wednesday
    const start = startOfUtcWeek(new Date('2026-07-22T15:00:00.000Z'))
    assert.equal(start.slice(0, 10), '2026-07-20')
  })

  it('briefNumber is deterministic and ≥1', () => {
    const n = briefNumberFromWeekStart('2026-07-20T00:00:00.000Z')
    assert.ok(n >= 1)
    assert.equal(briefNumberFromWeekStart('2026-01-05T00:00:00.000Z'), 1)
  })
})
