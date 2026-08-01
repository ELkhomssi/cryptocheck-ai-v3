/**
 * Live Attention Feed — merge / fingerprint / no filler.
 * Run: node --import tsx --test __tests__/attention-feed/live-merge.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLiveEntries } from '../../features/attention-feed/lib/merge-live-entries'
import { attentionFingerprint } from '../../lib/terminal-os/attention-store'
import type { AttentionItem } from '../../features/attention-feed/types'

function item(partial: Partial<AttentionItem> & Pick<AttentionItem, 'id'>): AttentionItem {
  return {
    sourceEngine: 'market-intelligence',
    urgency: 'today',
    headline: partial.headline ?? partial.id,
    reality: 'r',
    analysis: 'a',
    evidence: [],
    createdAt: partial.createdAt ?? '2026-08-01T00:00:00.000Z',
    rankScore: 50,
    ...partial,
  }
}

describe('live attention merge', () => {
  it('labels new vs updated from event hints', () => {
    const entries = mergeLiveEntries(
      [item({ id: 'a' }), item({ id: 'b' })],
      [
        { itemId: 'a', kind: 'new', at: '2026-08-01T12:00:00.000Z' },
        { itemId: 'b', kind: 'updated', at: '2026-08-01T12:00:00.000Z' },
      ],
      0,
      {},
    )
    assert.equal(entries[0]!.kind, 'new')
    assert.equal(entries[1]!.kind, 'updated')
    assert.equal(entries[0]!.sinceAway, false)
  })

  it('marks sinceAway only when lastSeen is in the past', () => {
    const lastSeen = Date.parse('2026-08-01T10:00:00.000Z')
    const entries = mergeLiveEntries(
      [item({ id: 'a', createdAt: '2026-08-01T11:00:00.000Z' })],
      [{ itemId: 'a', kind: 'new', at: '2026-08-01T11:00:00.000Z' }],
      lastSeen,
      {},
    )
    assert.equal(entries[0]!.sinceAway, true)
  })

  it('fingerprint ignores createdAt noise', () => {
    const a = item({ id: 'x', headline: 'same', createdAt: '2026-01-01T00:00:00.000Z' })
    const b = item({ id: 'x', headline: 'same', createdAt: '2026-08-01T00:00:00.000Z' })
    assert.equal(attentionFingerprint(a), attentionFingerprint(b))
    const c = item({ id: 'x', headline: 'changed', createdAt: a.createdAt })
    assert.notEqual(attentionFingerprint(a), attentionFingerprint(c))
  })
})
