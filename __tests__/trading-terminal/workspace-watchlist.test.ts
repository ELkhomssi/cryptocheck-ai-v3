import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseWorkspace, emptySlots } from '@/lib/trading-terminal/workspace-storage'
import {
  parseWatchlists,
  upsertWatchlistItem,
  removeWatchlistItem,
  cycleWatchlistId,
  defaultWatchlists,
} from '@/lib/trading-terminal/watchlist-storage'
import { encodeTitDrag, decodeTitDrag } from '@/lib/trading-terminal/dnd'

const MINT = 'So11111111111111111111111111111111111111112'

describe('parseWorkspace', () => {
  it('returns null for garbage', () => {
    assert.equal(parseWorkspace(null), null)
    assert.equal(parseWorkspace('{'), null)
    assert.equal(parseWorkspace('{"v":2}'), null)
  })

  it('normalizes slot count to chart mode', () => {
    const ws = parseWorkspace(
      JSON.stringify({
        v: 1,
        chartMode: 4,
        slots: [{ mint: MINT, symbol: 'SOL', locked: true }],
        activeSlot: 9,
        focusMint: MINT,
        focusSymbol: 'SOL',
        coachCollapsed: false,
        discoverCollapsed: true,
        activeWatchlistId: 'default',
        updatedAt: '2026-07-20T00:00:00.000Z',
      }),
    )
    assert.ok(ws)
    assert.equal(ws.chartMode, 4)
    assert.equal(ws.slots.length, 4)
    assert.equal(ws.slots[0]!.mint, MINT)
    assert.equal(ws.slots[0]!.locked, true)
    assert.equal(ws.slots[1]!.mint, '')
    assert.equal(ws.activeSlot, 3)
    assert.equal(ws.discoverCollapsed, true)
  })

  it('emptySlots length matches mode', () => {
    assert.equal(emptySlots(6).length, 6)
  })
})

describe('watchlist storage', () => {
  it('defaults on empty', () => {
    const d = parseWatchlists(null)
    assert.equal(d.lists.length, 1)
    assert.equal(d.lists[0]!.id, 'default')
  })

  it('upserts and removes', () => {
    let lists = defaultWatchlists().lists
    lists = upsertWatchlistItem(lists, 'default', { mint: MINT, symbol: 'SOL' })
    assert.equal(lists[0]!.items.length, 1)
    lists = upsertWatchlistItem(lists, 'default', {
      mint: MINT,
      symbol: 'SOL',
      lastVerdict: 'CAUTION',
      lastRiskScore: 55,
    })
    assert.equal(lists[0]!.items.length, 1)
    assert.equal(lists[0]!.items[0]!.lastVerdict, 'CAUTION')
    lists = removeWatchlistItem(lists, 'default', MINT)
    assert.equal(lists[0]!.items.length, 0)
  })

  it('cycles list ids', () => {
    const lists = [
      { id: 'a', name: 'A', items: [] },
      { id: 'b', name: 'B', items: [] },
    ]
    assert.equal(cycleWatchlistId(lists, 'a'), 'b')
    assert.equal(cycleWatchlistId(lists, 'b'), 'a')
  })
})

describe('dnd payload', () => {
  it('round-trips', () => {
    const enc = encodeTitDrag({ mint: MINT, symbol: 'SOL' })
    const dec = decodeTitDrag(enc)
    assert.deepEqual(dec, { mint: MINT, symbol: 'SOL' })
  })

  it('rejects short mint', () => {
    assert.equal(decodeTitDrag(JSON.stringify({ mint: 'abc', symbol: 'X' })), null)
  })
})
