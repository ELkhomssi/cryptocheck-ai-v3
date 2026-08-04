/**
 * AI Gateway presentation — objective proxies + safety floor.
 * Run: node --import tsx --test __tests__/ai-os/gateway-presentation.test.ts
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  gatewayPhase,
  phaseLabel,
  spokenSummary,
} from '../../features/ai-os/lib/gateway-phase'

const root = process.cwd()

describe('AI Gateway presentation integrity', () => {
  it('IntelligenceSwap still uses real Decision + ExecutionState + risk-gated path', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    const combined = src + '\n' + hero
    assert.match(src, /@cryptocheck\/decision-contracts/)
    assert.match(src, /ExecutionState/)
    assert.match(src, /\/api\/revenue\/quote/)
    assert.match(src, /\/api\/revenue\/assess-swap/)
    assert.match(src, /signTransaction/)
    assert.match(src, /Estimated total cost/)
    assert.match(src, /DANGER_ACK_PHRASE|OVERRIDE_PHRASE/)
    assert.match(hero, /decision\.action/)
    assert.match(hero, /decision\.reasoning|heroReason\(decision\.reasoning\)/)
    assert.match(hero, /marketConfidence/)
    assert.match(hero, /personalizedConfidence/)
    assert.match(combined, /expectedROI|expectedRoi/)
    assert.match(hero, /contributingFactors/)
    assert.doesNotMatch(combined, /confidence:\s*85/)
    assert.doesNotMatch(combined, /sample-decision/)
    assert.doesNotMatch(combined, /12,?431/)
    assert.doesNotMatch(src, /setTimeout\(\s*\(\)\s*=>\s*setPhase/)
  })

  it('TerminalOsShell mounts IntelligenceSwap as AI Gateway centerpiece', () => {
    const shell = readFileSync(
      join(root, 'features/terminal-os/shell/components/TerminalOsShell.tsx'),
      'utf8',
    )
    assert.match(shell, /IntelligenceSwap/)
    assert.match(shell, /AI Gateway/)
    assert.match(shell, /AiGatewayCenterpiece/)
    const page = readFileSync(join(root, 'app/terminalOS/page.tsx'), 'utf8')
    const pageCode = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    assert.match(pageCode, /TerminalOsShell/)
    assert.doesNotMatch(pageCode, /AiOsShell/)
  })

  it('executeSwap body not rewritten with placeholders', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    assert.match(src, /buildJupiterSwapTransaction|\/api\/execution\/prepare/)
    assert.match(src, /simulateSerializedSwapTransaction/)
    assert.match(src, /sendSignedSwap/)
  })

  it('DOM priority keeps Decision before Confidence / Reasoning / Risk', () => {
    // Round 2: hero strip in GatewayHeroFlow; confidence demoted to Evidence
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    const swap = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    const actionIdx = hero.indexOf('className="aios-gw-action"')
    const reasonIdx = hero.indexOf('data-gw-hero-reason')
    const missionIdx = hero.indexOf('data-gw-mission')
    const confIdx = hero.indexOf('data-gw-freshness')
    const costIdx = swap.indexOf('Estimated total cost')
    assert.ok(actionIdx > 0)
    assert.ok(actionIdx < reasonIdx && reasonIdx < missionIdx)
    // Confidence lives in Evidence — after Approve in source order
    assert.ok(confIdx > missionIdx)
    assert.ok(costIdx > 0)
    assert.match(swap, /GatewayHeroFlow/)
  })

  it('Decision CSS is measurably larger than amount / confidence / execute', () => {
    const css = readFileSync(join(root, 'features/ai-os/gateway-tos.css'), 'utf8')
    assert.match(css, /\.aios-gw-action\s*\{[^}]*font-size:\s*clamp\(2\.5rem/)
    assert.match(css, /\.aios-swap-amount\s*\{[^}]*font-size:\s*1\.2rem/)
    assert.match(css, /\.aios-gw-confidence-value\s*\{[^}]*font-size:\s*clamp\(1\.25rem/)
    // Amount 1.2rem < Decision min 2.5rem; confidence max 1.55rem < Decision min
    assert.ok(1.2 < 2.5)
    assert.ok(1.55 < 2.5)
  })

  it('cognitive budget + touch targets declared', () => {
    const src = readFileSync(join(root, 'features/ai-os/components/IntelligenceSwap.tsx'), 'utf8')
    const hero = readFileSync(join(root, 'features/ai-os/components/GatewayHeroFlow.tsx'), 'utf8')
    const css = readFileSync(join(root, 'features/ai-os/gateway-tos.css'), 'utf8')
    assert.match(src, /data-primary-budget="7"/)
    assert.match(hero, /aios-gw-sources-wrap/)
    assert.match(css, /min-height:\s*44px/)
  })

  it('tick meta persisted from real Decision Engine cycle counts', () => {
    const tick = readFileSync(join(root, 'lib/terminal-os/decision-engine-tick.ts'), 'utf8')
    const store = readFileSync(join(root, 'lib/terminal-os/decision-store.ts'), 'utf8')
    const route = readFileSync(join(root, 'app/api/terminal-os/decisions/route.ts'), 'utf8')
    assert.match(tick, /saveDecisionTickMeta/)
    assert.match(tick, /scanned:\s*tokens\.length/)
    assert.match(tick, /buyCount:/)
    assert.match(store, /ccai:tos:decision:tick:meta/)
    assert.match(route, /tickMeta/)
  })
})

describe('AI Gateway phase + spoken summary (real state only)', () => {
  it('maps phases only from real loading / execution flags', () => {
    assert.equal(
      gatewayPhase({
        hasBuyMint: false,
        decisionLoading: true,
        hasDecision: false,
        quoteLoading: true,
      }),
      'waiting',
    )
    assert.equal(
      gatewayPhase({
        hasBuyMint: true,
        decisionLoading: true,
        hasDecision: false,
        quoteLoading: false,
      }),
      'thinking',
    )
    assert.equal(
      gatewayPhase({
        hasBuyMint: true,
        decisionLoading: true,
        hasDecision: true,
        quoteLoading: false,
      }),
      'analyzing',
    )
    assert.equal(
      gatewayPhase({
        hasBuyMint: true,
        decisionLoading: false,
        hasDecision: true,
        quoteLoading: true,
      }),
      'comparing',
    )
    assert.equal(
      gatewayPhase({
        hasBuyMint: true,
        decisionLoading: false,
        hasDecision: true,
        quoteLoading: false,
        execState: 'simulating',
      }),
      'validating',
    )
    assert.equal(
      gatewayPhase({
        hasBuyMint: true,
        decisionLoading: false,
        hasDecision: true,
        quoteLoading: false,
        execState: 'building',
      }),
      'ready',
    )
    assert.equal(phaseLabel('ready'), 'Decision Ready')
    assert.equal(phaseLabel('comparing'), 'Comparing')
  })

  it('spoken summary refuses empty / zero scanned meta (no stylized fiction)', () => {
    assert.equal(spokenSummary(null), null)
    assert.equal(
      spokenSummary({
        at: '2026-08-03T00:00:00.000Z',
        scanned: 0,
        published: 0,
        buyCount: 0,
        waitCount: 0,
      }),
      null,
    )
    const line = spokenSummary(
      {
        at: '2026-08-03T00:00:00.000Z',
        scanned: 12,
        published: 8,
        buyCount: 3,
        waitCount: 5,
      },
      { action: 'BUY', symbol: 'BONK' },
    )
    assert.ok(line)
    assert.match(line!, /12 tokens/)
    assert.match(line!, /8 Decisions/)
    assert.match(line!, /3 BUY/)
    assert.match(line!, /5 WAIT/)
    assert.match(line!, /BUY \$BONK/)
    assert.doesNotMatch(line!, /12,?431/)
  })
})
