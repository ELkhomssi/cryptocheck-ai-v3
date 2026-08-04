/**
 * Chart AI overlays prefer published Decision; no fabricated BUY zones.
 * Run: node --import tsx --test __tests__/intelligence-chart/assemble-zones.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Intelligence Chart Decision zone sync', () => {
  it('assembler binds zones to getDecisionByTokenId; omits SL/TP invention', () => {
    const src = readFileSync(
      join(root, 'features/intelligence-chart/engines/assemble-chart-bundle.ts'),
      'utf8',
    )
    assert.match(src, /getDecisionByTokenId/)
    assert.match(src, /buildAiOverlays/)
    assert.match(src, /AI Entry Zone/)
    assert.match(src, /No Decision published yet/)
    assert.match(src, /Stop Loss \/ Take Profit/)
    // Old loophole: BUY zone from ROI without BUY action
    assert.doesNotMatch(src, /expectedRoiPct > 2/)
    assert.doesNotMatch(src, /whaleBias === 'distributing'/)
  })
})
