/**
 * Classic Terminal PRO home — restored shell composition.
 * Run: node --import tsx --test __tests__/terminal-os/classic-pro-restore.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Classic Terminal PRO restore', () => {
  it('shell always mounts whale + lifecycle + classic right rail', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(shell, /data-tos-classic=\"v6\"/)
    assert.match(shell, /WhaleMarqueeTicker/)
    assert.match(shell, /MoneyLifecycleRibbon/)
    assert.match(shell, /TokenScoreScanCard/)
    assert.match(shell, /QuickSwapCard/)
    assert.match(shell, /WalletScoreScanCard/)
    assert.doesNotMatch(shell, /if \(homeMode\) return null/)
  })

  it('home desk is Gateway + traders/tokens + chart (not MC 3-col)', () => {
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    assert.match(desk, /tos-classic-desk|data-tos-classic/)
    assert.match(desk, /IntelligenceSwap/)
    assert.match(desk, /TopTradersTicker/)
    assert.match(desk, /TopTokensToday/)
    assert.match(desk, /IntelligenceChart/)
    assert.match(desk, /SOL_MINT/)
    assert.match(desk, /WalletRiskShield|wallet-shield/)
    assert.doesNotMatch(desk, /tos-mc-grid/)
    assert.doesNotMatch(desk, /guaranteed|70% fewer/)
  })

  it('LeftRail mounts Trade Like Me moat card + classic Terminal nav', () => {
    const rail = readFileSync(
      join(root, 'features/terminal-os/shell/components/LeftRail.tsx'),
      'utf8',
    )
    assert.match(rail, /TERMINAL OS|TERMINAL.*v6/)
    assert.match(rail, /AiTradeLikeMeCard/)
    assert.match(rail, /AiStatusCard/)
    assert.match(rail, /label: 'Terminal'/)
    assert.match(rail, /Mission Control/)
    assert.match(rail, /Whale Tracking/)
  })

  it('TLM card states DNA method + DANGER gate without loss guarantees', () => {
    const tlm = readFileSync(
      join(root, 'features/terminal-os/ai-trade-like-me/components/AiTradeLikeMeCard.tsx'),
      'utf8',
    )
    assert.match(tlm, /Train AI From My Trading/)
    assert.match(tlm, /DANGER/)
    assert.match(tlm, /Not a guarantee of fewer losses/)
    assert.doesNotMatch(tlm, /guaranteed 70%/)
  })
})
