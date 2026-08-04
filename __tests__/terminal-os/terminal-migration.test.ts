/**
 * /terminal retired → /terminalOS hosts Mission Control + AI Coach.
 * Run: node --import tsx --test __tests__/terminal-os/terminal-migration.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('terminal → terminalOS migration', () => {
  it('next.config is the sole /terminal → /terminalOS redirect (no PortfolioProviders route)', () => {
    const cfg = readFileSync(join(root, 'next.config.js'), 'utf8')
    assert.match(cfg, /source:\s*'\/terminal'/)
    assert.match(cfg, /destination:\s*'\/terminalOS'/)
    assert.match(cfg, /source:\s*'\/portfolio'/)
    try {
      readFileSync(join(root, 'app/terminal/layout.tsx'), 'utf8')
      assert.fail('expected app/terminal to be removed')
    } catch (e) {
      assert.equal((e as NodeJS.ErrnoException).code, 'ENOENT')
    }
  })

  it('Terminal OS shell mounts Mission Control + migrated AI Coach', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(shell, /MissionControlWorkspace/)
    assert.match(shell, /AiCoachWorkspace/)
    assert.match(shell, /mission-control/)
  })

  it('terminalOS layout uses TerminalOsProviders + portfolio theme for MC/coach', () => {
    const layout = readFileSync(join(root, 'app/terminalOS/layout.tsx'), 'utf8')
    assert.match(layout, /TerminalOsProviders/)
    assert.match(layout, /portfolio-desk\/theme\.css/)
    assert.doesNotMatch(layout, /PortfolioProviders/)
  })
})
