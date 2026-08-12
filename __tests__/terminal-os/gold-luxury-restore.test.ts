/**
 * Restore TerminalOS Premium black + gold from git history.
 * Source of truth: git commit f941f0e^ (last Premium black + gold before Image-2 teal desk / Picture-1 cyan).
 * Picture-1 (552c4a7) introduced navy/cyan/mint — that redesign is NOT restored.
 * Run: node --import tsx --test __tests__/terminal-os/gold-luxury-restore.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const GOLD_REV = 'f941f0e^'

describe('TerminalOS gold restoration from git history', () => {
  it('CSS root matches last pure Premium black + gold tokens', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    const goldEra = execSync(`git show ${GOLD_REV}:styles/terminal-os.css`, {
      encoding: 'utf8',
      cwd: root,
    })
    const goldHeader = goldEra.slice(0, goldEra.indexOf('[data-tos] *'))
    const cssHeader = css.slice(0, css.indexOf('[data-tos] *'))

    assert.match(css, /Premium black \+ gold theme/)
    assert.match(css, /--tos-accent-gold:\s*#d4af37/)
    assert.match(css, /--tos-accent-gold-bright:\s*#f0c14b/)
    assert.match(css, /--tos-bg-app:\s*#050505/)
    assert.match(css, /--tos-bg-panel:\s*#0a0a0a/)
    assert.match(css, /--tos-glass-border:\s*color-mix\(in srgb, var\(--tos-accent-gold\)/)
    assert.match(css, /--tos-shadow-focus:\s*0 0 0 2px var\(--tos-accent-gold-bright\)/)

    assert.doesNotMatch(cssHeader, /--tos-accent-cyan:/)
    assert.doesNotMatch(cssHeader, /--tos-accent-mint:/)
    assert.doesNotMatch(cssHeader, /--tos-bg-app:\s*#0a0e14/)
    assert.doesNotMatch(cssHeader, /--tos-accent-gold:\s*#ffb800/)

    for (const line of [
      '--tos-bg-app: #050505;',
      '--tos-accent-gold: #d4af37;',
      '--tos-accent-gold-bright: #f0c14b;',
      '--tos-positive: #16c784;',
      '--tos-negative: #ea3943;',
    ]) {
      assert.ok(goldHeader.includes(line), `gold era missing ${line}`)
      assert.ok(cssHeader.includes(line), `restored CSS missing archive token ${line}`)
    }
  })

  it('nav active state uses gold-era treatment (not cyan)', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(
      css,
      /\.tos-nav-item\[data-active='true'\]\s*\{[^}]*background:\s*var\(--tos-accent-gold-dim\)/,
    )
    assert.match(
      css,
      /\.tos-nav-item\[data-active='true'\]\s*\{[^}]*color:\s*var\(--tos-accent-gold\)/,
    )
  })

  it('layout stays data-tos only (no invented brass theme wrapper)', () => {
    const layout = readFileSync(join(root, 'app/terminalOS/layout.tsx'), 'utf8')
    assert.match(layout, /data-tos/)
    assert.doesNotMatch(layout, /data-theme=["']brass["']/)
  })

  it('gateway execute CTA uses archive gold stops (no orange redesign tail)', () => {
    const gw = readFileSync(join(root, 'features/ai-os/gateway-tos.css'), 'utf8')
    assert.match(gw, /#d4af37/)
    assert.doesNotMatch(gw, /#ff8a00/)
    assert.doesNotMatch(gw, /#00e0ff/)
  })

  it('preserves current classic PRO functionality wiring', () => {
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(desk, /IntelligenceSwap/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(shell, /WhaleMarqueeTicker/)
    assert.match(shell, /QuickSwapCard/)
  })
})
