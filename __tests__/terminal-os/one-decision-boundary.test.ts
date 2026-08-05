/**
 * CI: Layer 4 must not import decide / buildMarketIntel.
 * Run: node --import tsx --test __tests__/terminal-os/one-decision-boundary.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const script = join(root, 'scripts/check-one-decision-boundary.cjs')

describe('One-Decision Layer 4 CI boundary', () => {
  it('lint script passes on current tree', () => {
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8', cwd: root })
    assert.equal(r.status, 0, r.stderr || r.stdout)
    assert.match(r.stdout, /OK/)
  })

  it('fails when a Layer 4 file imports decide', () => {
    const probeDir = join(root, 'features/ai-os/components')
    assert.equal(existsSync(probeDir), true)
    const probe = join(probeDir, '__ci_probe_decide_ban__.tsx')
    writeFileSync(
      probe,
      `import { decide } from '@/features/terminal-os/ai-trade-like-me/engines/decision-engine'\nexport const x = decide(null, {} as never)\n`,
    )
    try {
      const r = spawnSync(process.execPath, [script], { encoding: 'utf8', cwd: root })
      assert.notEqual(r.status, 0, 'expected CI failure on direct decide import')
      assert.match(r.stderr + r.stdout, /decide|Decision Engine|FAILED/i)
    } finally {
      unlinkSync(probe)
    }
  })
})
