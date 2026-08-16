/**
 * Pro command-center densify — real algorithms mesh + 6h wallet scan + multi-chain tick.
 * Run: node --import tsx --test __tests__/terminal-os/pro-command-center.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Terminal OS pro command center', () => {
  it('Decision tick merges multi-chain tokens; security Solana-only via gateway', () => {
    const tick = readFileSync(join(root, 'lib/terminal-os/decision-engine-tick.ts'), 'utf8')
    assert.match(tick, /TICK_CHAINS/)
    assert.match(tick, /ethereum/)
    assert.match(tick, /bnb/)
    assert.match(tick, /loadMultiChainTokens/)
    assert.match(tick, /assessRiskByMint/)
    assert.match(tick, /security-scanner/)
    assert.doesNotMatch(tick, /scanner-engine/)
  })

  it('6h wallet-scan-feedback cron + API wired; scan gateway only', () => {
    const cron = readFileSync(join(root, 'app/api/cron/wallet-scan-feedback/route.ts'), 'utf8')
    const api = readFileSync(join(root, 'app/api/terminal-os/wallet-feedback/route.ts'), 'utf8')
    const lib = readFileSync(join(root, 'lib/terminal-os/wallet-scan-feedback.ts'), 'utf8')
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8')
    assert.match(cron, /runWalletScanFeedbackTick/)
    assert.match(api, /getWalletScanFeedback|runWalletScanFeedbackForWallet/)
    assert.match(lib, /assessRiskByMint/)
    assert.match(lib, /ccai:tos:wallet-feedback:/)
    assert.match(vercel, /wallet-scan-feedback/)
    assert.match(vercel, /0 \*\/6 \* \* \*/)
  })

  it('Home desk is mockup-wired PRO; Coach reads wallet scan; MONITOR missions remain in panels', () => {
    const desk = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsHomeDesk.tsx'),
      'utf8',
    )
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    const coach = readFileSync(
      join(root, 'features/terminal-os/shell/components/PersistentCoachRail.tsx'),
      'utf8',
    )
    assert.match(desk, /tos-mockup-desk|IntelligenceSwap/)
    assert.match(desk, /ScannerDiscoveryStrip|IntelligenceChart/)
    assert.match(panels, /MONITOR/)
    assert.match(panels, /Algorithm Mesh/)
    assert.match(coach, /wallet-feedback/)
    assert.match(coach, /wallet-scan/)
    assert.doesNotMatch(panels, /37,?584/)
    assert.doesNotMatch(panels, /87% DNA/)
  })

  it('Brain slots only use wired engines (no permanent Social/Funding dead nodes)', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    assert.doesNotMatch(panels, /Social Momentum/)
    assert.doesNotMatch(panels, /Funding Rate/)
    assert.match(panels, /trader-dna/)
  })
})
