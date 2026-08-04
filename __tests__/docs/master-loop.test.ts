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
    assert.doesNotMatch(src, /9\.7\/10/)
  })

  it('canonical docs/MASTER_LOOP.md + .cursorrules pointer', () => {
    const doc = readFileSync(join(root, 'docs/MASTER_LOOP.md'), 'utf8')
    assert.match(doc, /MASTER LOOP/)
    assert.match(doc, /autonomous financial operating system/i)
    assert.match(doc, /Run the Master Loop/)
    const rules = readFileSync(join(root, '.cursorrules'), 'utf8')
    assert.match(rules, /master-loop\.mdc/)
    assert.match(rules, /docs\/MASTER_LOOP\.md/)
  })
})
