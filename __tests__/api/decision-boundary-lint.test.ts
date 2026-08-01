/**
 * Ensures the decision-boundary lint script exits 0 on the current tree.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

describe('lint:decision-boundary', () => {
  it('passes with zero Layer 4 → Layer 1 import violations', () => {
    const script = path.join(process.cwd(), 'scripts/check-decision-boundary.cjs')
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /lint:decision-boundary OK/)
  })
})
