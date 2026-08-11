/**
 * Chart Intelligence workspace — wallet Decision alerts + layout mount.
 * Run: node --import tsx --test __tests__/terminal-os/chart-wallet-workspace.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Decision } from '@cryptocheck/decision-contracts'
import { buildWalletDecisionAlerts } from '../../features/terminal-os/chart-intelligence/lib/wallet-decision-alerts'

const root = process.cwd()

function decision(over: Partial<Decision> & Pick<Decision, 'action' | 'id'>): Decision {
  return {
    id: over.id,
    subject: over.subject ?? {
      kind: 'token',
      symbol: 'SOL',
      address: 'So11111111111111111111111111111111111111112',
      chain: 'solana',
    },
    action: over.action,
    confidence: over.confidence ?? 70,
    marketConfidence: over.marketConfidence ?? 70,
    confidenceMode: 'market',
    reasoning: over.reasoning ?? 'Test reasoning',
    contributingFactors: over.contributingFactors ?? [],
    risk: over.risk ?? 20,
    degraded: false,
    computedAt: '2026-08-11T12:00:00.000Z',
    staleAfter: '2026-08-11T12:05:00.000Z',
    ...over,
  }
}

describe('buildWalletDecisionAlerts', () => {
  it('emits exit from Decision EXIT/SELL on held mint; entry from BUY + whale buy', () => {
    const holdings = [
      {
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        change24hPct: -3.2,
        valueUsd: 1000,
      },
    ]
    const decisions = [
      decision({ id: 'd-exit', action: 'EXIT', confidence: 81 }),
      decision({
        id: 'd-buy',
        action: 'BUY',
        confidence: 77,
        subject: {
          kind: 'token',
          symbol: 'JUP',
          address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
          chain: 'solana',
        },
      }),
    ]
    const whales = [{ assetSymbol: 'JUP', action: 'buy', usdValue: 250_000 }]
    const alerts = buildWalletDecisionAlerts({ holdings, decisions, whales })
    assert.ok(alerts.some((a) => a.kind === 'exit' && a.symbol === 'SOL'))
    assert.ok(alerts.some((a) => a.kind === 'entry' && a.symbol === 'JUP' && a.decisionId === 'd-buy'))
    assert.ok(alerts.every((a) => a.kind !== 'entry' || a.decisionId != null))
  })

  it('watch-only on sharp drop without EXIT Decision — never invents exit command', () => {
    const alerts = buildWalletDecisionAlerts({
      holdings: [{ mint: 'mint1', symbol: 'BONK', change24hPct: -12.5, valueUsd: 40 }],
      decisions: [],
      whales: [],
    })
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0]!.kind, 'watch')
    assert.match(alerts[0]!.headline, /awaiting Decision/)
    assert.equal(alerts[0]!.decisionId, null)
  })

  it('does not fabricate alerts when holdings and decisions empty', () => {
    assert.deepEqual(buildWalletDecisionAlerts({ holdings: [], decisions: [], whales: [] }), [])
  })
})

describe('Chart Intelligence workspace wiring', () => {
  it('shell mounts ChartIntelligenceWorkspace for chart-intelligence nav', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    const ws = readFileSync(
      join(root, 'features/terminal-os/chart-intelligence/components/ChartIntelligenceWorkspace.tsx'),
      'utf8',
    )
    assert.match(shell, /ChartIntelligenceWorkspace/)
    assert.match(shell, /chartMode/)
    assert.match(ws, /WalletDecisionAlertsStrip/)
    assert.match(ws, /PortfolioOverviewPanel/)
    assert.match(ws, /WalletScoreScanCard/)
    assert.match(ws, /IntelligenceChart/)
    assert.doesNotMatch(ws, /37,?584/)
    assert.doesNotMatch(ws, /87% DNA/)
  })
})
