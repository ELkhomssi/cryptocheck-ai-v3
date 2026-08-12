/**
 * Attests TerminalOS UI tree matches archive commit f941f0e^ (182b647).
 * Run: node --import tsx --test __tests__/terminal-os/archive-restore.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'

const root = process.cwd()
const ARCHIVE = 'f941f0e^'
const ARCHIVE_SHA = '182b6473691af1174e5773d91f7578615d359787'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function archiveBlob(path: string) {
  return execSync(`git show ${ARCHIVE}:${path}`, { encoding: 'utf8', cwd: root })
}

describe('TerminalOS full archive restore (f941f0e^)', () => {
  it('resolves archive to expected SHA', () => {
    const sha = execSync(`git rev-parse ${ARCHIVE}`, { encoding: 'utf8', cwd: root }).trim()
    assert.equal(sha, ARCHIVE_SHA)
  })

  it('shell / LeftRail / CSS match archive byte-for-byte', () => {
    const paths = [
      'styles/terminal-os.css',
      'features/terminal-os/shell/components/LeftRail.tsx',
      'features/terminal-os/shell/components/TopBar.tsx',
      'features/terminal-os/shell/components/TerminalOsShell.tsx',
      'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx',
      'features/terminal-os/shell/components/HomeDeskPanels.tsx',
      'app/terminalOS/page.tsx',
      'app/terminalOS/layout.tsx',
    ]
    for (const p of paths) {
      const disk = readFileSync(join(root, p), 'utf8')
      const arch = archiveBlob(p)
      assert.equal(sha256(disk), sha256(arch), `${p} diverges from ${ARCHIVE}`)
    }
  })

  it('Premium black + gold tokens present; no Picture-1 cyan identity in root', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    const header = css.slice(0, css.indexOf('[data-tos] *'))
    assert.match(header, /Premium black \+ gold theme/)
    assert.match(header, /--tos-bg-app:\s*#050505/)
    assert.match(header, /--tos-accent-gold:\s*#d4af37/)
    assert.match(header, /--tos-accent-gold-bright:\s*#f0c14b/)
    assert.doesNotMatch(header, /--tos-accent-cyan:/)
    assert.doesNotMatch(header, /--tos-accent-mint:/)
    assert.doesNotMatch(header, /#00e0ff/)
  })

  it('post-archive components are absent', () => {
    const gone = [
      'features/terminal-os/chart-intelligence/components/ChartIntelligenceWorkspace.tsx',
      'features/terminal-os/shell/components/MissionControlPanels.tsx',
      'features/terminal-os/shell/components/SystemStatusGauges.tsx',
      'features/terminal-os/portfolio-os/components/PortfolioAllocationDonut.tsx',
    ]
    for (const p of gone) {
      assert.equal(existsSync(join(root, p)), false, `expected removed: ${p}`)
    }
  })

  it('LeftRail uses archive Mission Control branding', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(rail, /MISSION CONTROL/)
    assert.match(rail, /AI COMMAND CENTER/)
  })
})
