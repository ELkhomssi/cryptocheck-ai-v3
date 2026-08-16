/**
 * Live density — waiting chrome stays honest; Decision tick resilient.
 * Run: node --import tsx --test __tests__/terminal-os/live-density.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { engineChecklist } from '@/features/ai-os/lib/gateway-round2'

const root = process.cwd()

describe('Terminal OS live density', () => {
  it('Gateway empty state has no STANDBY chrome or fabricated scores', () => {
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    assert.doesNotMatch(hero, /\bSTANDBY\b/)
    assert.doesNotMatch(hero, /data-gw-standby|aios-gw-standby|standbyHeroMetrics/)
    assert.match(hero, /No Decision published yet/)
    assert.ok(
      engineChecklist({ decisionLoading: false, decision: null }).every((r) => r.status === 'standby'),
    )
  })

  it('decisions route surfaces tickError when tick publishes nothing', () => {
    const route = readFileSync(join(root, 'app/api/terminal-os/decisions/route.ts'), 'utf8')
    assert.match(route, /tickError/)
    assert.match(route, /tick_empty|tick_failed/)
  })

  it('decision tick falls back Solana + never throws away partial publishes on Redis fail', () => {
    const tick = readFileSync(join(root, 'lib/terminal-os/decision-engine-tick.ts'), 'utf8')
    assert.match(tick, /multi-chain token load failed — Solana fallback/)
    assert.match(tick, /saveDecision\(decision\)\.catch/)
    assert.match(tick, /saveDecisionTickMeta\([\s\S]*?\)\.catch/)
    assert.match(tick, /token failed/)
  })

  it('missions + gateway + alerts keep honest waiting chrome (no Solana-only EVM lie)', () => {
    const panels = readFileSync(
      join(root, 'features/terminal-os/shell/components/HomeDeskPanels.tsx'),
      'utf8',
    )
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    const alerts = readFileSync(
      join(root, 'features/terminal-os/chart-intelligence/components/WalletDecisionAlertsStrip.tsx'),
      'utf8',
    )
    assert.match(panels, /tos-missions-list--standby/)
    assert.match(panels, /No active missions/)
    assert.match(hero, /data-gw-empty|No Decision published yet/)
    assert.doesNotMatch(alerts, /Solana holdings only/)
    assert.match(alerts, /EVM holdings · quiet|Connect a Solana or EVM wallet/)
  })
})
