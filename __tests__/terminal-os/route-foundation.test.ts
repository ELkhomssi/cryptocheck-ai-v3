/**
 * /terminalOS mounts original Terminal OS only — no ModeRouter / Simple / Pro.
 * Run: node --import tsx --test __tests__/terminal-os/route-foundation.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('terminalOS foundation route', () => {
  it('page mounts TerminalOsShell with no ModeRouter / AiOsShell / legacy', () => {
    const page = readFileSync(join(root, 'app/terminalOS/page.tsx'), 'utf8')
    const code = page
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    assert.match(code, /TerminalOsShell/)
    assert.doesNotMatch(code, /ModeRouter/)
    assert.doesNotMatch(code, /AiOsShell/)
    assert.doesNotMatch(code, /SimpleModeShell/)
    assert.doesNotMatch(code, /legacy/)
    assert.doesNotMatch(code, /FloatingModeToggle/)
  })

  it('attention-feed barrel no longer exports ModeRouter or SimpleModeShell', () => {
    const barrel = readFileSync(join(root, 'features/attention-feed/index.ts'), 'utf8')
    assert.doesNotMatch(barrel, /ModeRouter/)
    assert.doesNotMatch(barrel, /SimpleModeShell/)
    assert.doesNotMatch(barrel, /FloatingModeToggle/)
  })
})
