/**
 * Gold / Black / Luxury TerminalOS visual restore (presentation only).
 * Run: node --import tsx --test __tests__/terminal-os/gold-luxury-restore.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('TerminalOS gold luxury restore', () => {
  it('centralizes CryptoCheck gold tokens (archive #d4af37 + brand #ffd700)', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(css, /--tos-accent-gold:\s*#d4af37/)
    assert.match(css, /--tos-accent-gold-bright:\s*#ffd700/)
    assert.match(css, /--cc-gold:\s*#ffd700/)
    assert.match(css, /--cc-gold-brass:\s*#c9a05a/)
    assert.match(css, /--tos-bg-app:\s*#050505/)
    assert.match(css, /--tos-bg-panel:\s*#0c0c0c/)
    assert.match(css, /--tos-glass-border:\s*rgba\(255,\s*215,\s*0,\s*0\.16\)/)
    /* Identity chrome remapped off cyan/mint/orange dashboards */
    assert.match(css, /--tos-accent-cyan:\s*#d4af37/)
    assert.match(css, /--tos-accent-mint:\s*#e5c35a/)
    assert.match(css, /--tos-accent-orange:\s*#d4af37/)
    assert.doesNotMatch(css, /--tos-accent-cyan:\s*#00e0ff/)
    assert.doesNotMatch(css, /--tos-accent-mint:\s*#00ffa3/)
    assert.doesNotMatch(css, /--tos-accent-orange:\s*#f97316/)
  })

  it('keeps green/red semantic (not brand identity)', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(css, /--tos-positive:\s*#00d084/)
    assert.match(css, /--tos-negative:\s*#ff4d4d/)
  })

  it('nav active + gold CTA use gold language', () => {
    const css = readFileSync(join(root, 'styles/terminal-os.css'), 'utf8')
    assert.match(css, /\.tos-nav-item\[data-active='true'\][\s\S]*?var\(--tos-accent-gold/)
    assert.match(css, /\.tos-btn-gold[\s\S]*?linear-gradient[\s\S]*?--tos-accent-gold/)
    assert.match(css, /\.tos-mc-execute[\s\S]*?#d4af37/)
  })

  it('layout scopes brass theme under Terminal OS only', () => {
    const layout = readFileSync(join(root, 'app/terminalOS/layout.tsx'), 'utf8')
    assert.match(layout, /data-tos/)
    assert.match(layout, /data-theme=["']brass["']/)
  })

  it('gateway execute CTA is archive gold (no orange tail)', () => {
    const gw = readFileSync(join(root, 'features/ai-os/gateway-tos.css'), 'utf8')
    assert.match(gw, /aios-swap-execute[\s\S]*?#d4af37/)
    assert.doesNotMatch(gw, /#ff8a00/)
  })

  it('does not alter classic PRO product structure', () => {
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
