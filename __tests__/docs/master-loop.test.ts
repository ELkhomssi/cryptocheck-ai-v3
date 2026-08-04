/**
 * Master Loop protocol presence — standing agent/human docs must exist.
 * Run: node --import tsx --test __tests__/docs/master-loop.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Master Loop protocol institutionalized', () => {
  it('alwaysApply cursor rule exists with safety carve-out + One-Decision + human checkpoint', () => {
    const path = join(root, '.cursor/rules/master-loop.mdc')
    assert.equal(existsSync(path), true)
    const src = readFileSync(path, 'utf8')
    assert.match(src, /alwaysApply:\s*true/)
    assert.match(src, /AUDIT BEFORE BUILD/)
    assert.match(src, /Simulate-before-sign/)
    assert.match(src, /No fabricated data/)
    assert.match(src, /One-Decision|ONE-DECISION/)
    assert.match(src, /HUMAN CHECKPOINT/)
    assert.match(src, /never self-certified|never grades its own/i)
    // 9.7/10 may appear only as a cautionary anti-pattern in "why this exists"
    assert.match(src, /9\.7\/10.*no ground truth|self-scores with no ground truth/i)
  })

  it('canonical docs/MASTER_LOOP.md + .cursorrules pointer', () => {
    const doc = readFileSync(join(root, 'docs/MASTER_LOOP.md'), 'utf8')
    assert.match(doc, /MASTER LOOP/)
    assert.match(doc, /autonomous financial operating system/i)
    assert.match(doc, /Run the Master Loop/)
    assert.match(doc, /SYSTEM EVOLUTION LOOP/)
    assert.match(doc, /Intentionally capped — protected by Step 2/)
    assert.match(doc, /requires dedicated safety review/)
    assert.match(doc, /capable, honest, and useful/)
    const rules = readFileSync(join(root, '.cursorrules'), 'utf8')
    assert.match(rules, /master-loop\.mdc/)
    assert.match(rules, /docs\/MASTER_LOOP\.md/)
    assert.match(rules, /Step 7 System Evolution/)
  })

  it('Step 7 in agent rule is subordinate to Step 2; invoke is Step 8', () => {
    const src = readFileSync(join(root, '.cursor/rules/master-loop.mdc'), 'utf8')
    assert.match(src, /STEP 7 — SYSTEM EVOLUTION/)
    assert.match(src, /subordinate to Step 2/)
    assert.match(src, /Intentionally capped — protected by Step 2/)
    assert.match(src, /Genuinely incomplete — safe to close/)
    assert.match(src, /requires dedicated safety review/)
    assert.match(src, /cannot carry default priority HIGH|cannot carry a default priority of HIGH/i)
    assert.match(src, /STEP 8 — HOW TO INVOKE/)
    assert.doesNotMatch(src, /treats low autonomy on execution as an incomplete gap to close by default/)
  })
})
