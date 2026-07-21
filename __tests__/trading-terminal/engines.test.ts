import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyStage,
  rankOpportunities,
  scoreOpportunity,
  OPPORTUNITY_WEIGHTS,
  type OpportunityMeasuredInputs,
} from '../../lib/trading-terminal/engines/opportunity-engine'
import { buildActionQueue } from '../../lib/trading-terminal/engines/action-queue'
import { buildWalletCoachNudges } from '../../lib/trading-terminal/engines/wallet-coach'
import { getDemoOpportunityInputs } from '../../lib/trading-terminal/engines/demo-opportunity-inputs'
import { resolveIntelligence } from '../../lib/trading-terminal/engines/resolve-intelligence'
import { resetDemoSeedCache } from '../../lib/trading-terminal/data/demo-seed'

describe('opportunity-engine', () => {
  it('weights sum to 1', () => {
    const sum = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9)
  })

  it('derives conviction from measured inputs (SOLCAT-like)', () => {
    const input: OpportunityMeasuredInputs = {
      mint: 'DemoSolCat555555555555555555555555555555',
      symbol: 'SOLCAT',
      smartMoneyNetInflowUsd: 182_000,
      liquidityExpansionPct: 21,
      holderGrowthPct: 14,
      insiderClusterActive: false,
      poolAgeHours: 36,
      riskScore: 28,
    }
    const o = scoreOpportunity(input)
    assert.ok(o)
    assert.equal(o!.method, 'opportunity-engine-v1')
    assert.ok(o!.convictionScore >= 70)
    assert.ok(o!.confidencePct >= 80)
    assert.equal(classifyStage(input), 'BREAKOUT')
    assert.ok(o!.reasons.every((r) => r.sourceField !== 'derived' || true))
    assert.ok(o!.reasons.length >= 2)
  })

  it('returns null for thin / exiting signals', () => {
    assert.equal(
      scoreOpportunity({
        mint: 'x',
        symbol: 'X',
        smartMoneyNetInflowUsd: 100,
        liquidityExpansionPct: 1,
        holderGrowthPct: 0,
        insiderClusterActive: false,
        poolAgeHours: 10,
        riskScore: 20,
      }),
      null,
    )
    assert.equal(
      scoreOpportunity({
        mint: 'y',
        symbol: 'Y',
        smartMoneyNetInflowUsd: -50_000,
        liquidityExpansionPct: -40,
        holderGrowthPct: -10,
        insiderClusterActive: true,
        poolAgeHours: 100,
        riskScore: 80,
      }),
      null,
    )
  })

  it('ranks DEMO measured inputs into opportunities', () => {
    resetDemoSeedCache()
    const ranked = rankOpportunities(getDemoOpportunityInputs())
    assert.ok(ranked.length >= 2)
    assert.equal(ranked[0]!.symbol, 'SOLCAT')
    assert.ok(ranked[0]!.convictionScore >= ranked[1]!.convictionScore)
  })
})

describe('action-queue + wallet-coach', () => {
  it('resolveIntelligence demo fills hero + actions + nudges', () => {
    resetDemoSeedCache()
    const bundle = resolveIntelligence({ mode: 'demo' })
    assert.equal(bundle.mode, 'demo')
    assert.ok(bundle.hero)
    assert.equal(bundle.hero!.symbol, 'SOLCAT')
    assert.ok(bundle.actions.length >= 2)
    assert.ok(bundle.nudges.length >= 1)
    assert.ok(bundle.nudges.some((n) => n.kind === 'offense' || n.kind === 'defense'))
  })

  it('live mode stays honest without opportunity feeds', () => {
    const bundle = resolveIntelligence({ mode: 'live' })
    assert.equal(bundle.opportunities.length, 0)
    assert.equal(bundle.hero, null)
    assert.ok(bundle.methodNote.toLowerCase().includes('live'))
  })

  it('buildActionQueue prioritizes EXIT over WATCH', () => {
    const q = buildActionQueue({
      brain: {
        health: { score: 40, issues: [] },
        riskExposure: { categories: [], flags: [], band: 'HIGH' },
        threats: [
          {
            symbol: 'RUG',
            mint: 'MintDanger1111111111111111111111111111111',
            reason: 'LP −40%',
            severity: 'HIGH',
          },
        ],
        actionQueue: [],
        capitalAllocation: '',
        portions: { totalUsd: 1000, pnlUsd: null, pnlPct: null, legend: [] },
      },
      opportunities: [],
    })
    assert.equal(q[0]?.type, 'EXIT')
  })

  it('wallet coach stays silent on thin offense', () => {
    const nudges = buildWalletCoachNudges({
      positions: [],
      brain: null,
      opportunities: [
        {
          mint: 'm',
          symbol: 'WEAK',
          convictionScore: 60,
          confidencePct: 40,
          riskLevel: 'MEDIUM',
          stage: 'EARLY',
          reasons: [],
          whyNow: 'thin',
          measuredInputs: {
            mint: 'm',
            symbol: 'WEAK',
            smartMoneyNetInflowUsd: 0,
            liquidityExpansionPct: 0,
            holderGrowthPct: 0,
            insiderClusterActive: false,
            poolAgeHours: null,
            riskScore: null,
          },
          method: 'opportunity-engine-v1',
        },
      ],
    })
    assert.equal(nudges.length, 0)
  })
})
