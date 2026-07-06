/**
 * AgentEngine fixtures (Prompt B).
 * Run: npx tsx src/agent/__tests__/agent-engine.fixture.ts
 */
import type { AgentConfig, EdgeSignal, UnifiedSignal } from '@cryptocheck/signal-contracts'
import { AgentEngine } from '../engine.js'
import { resetMatchWindows, evaluateSportsSignal } from '../../gate/sports-evaluator.js'

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

function edge(partial: Partial<EdgeSignal> & Pick<EdgeSignal, 'magnitude' | 'confidence' | 'rationale'>): EdgeSignal {
  return {
    fairValue: 1.8,
    marketValue: 2.2,
    detectors: [
      {
        detector: 'latency_edge',
        magnitude: partial.magnitude,
        confidence: partial.confidence,
        rationale: partial.rationale,
        fairValue: 1.8,
        marketValue: 2.2,
        actionable: true,
      },
    ],
    anomalyOnly: false,
    evaluatedAt: new Date().toISOString(),
    ...partial,
  }
}

function signal(partial: Partial<UnifiedSignal> & Pick<UnifiedSignal, 'id' | 'type'>): UnifiedSignal {
  const e = partial.edgeSignal
  return {
    sourceTag: 'txodds',
    sourceRef: partial.id,
    subjectType: 'match_event',
    label: 'ARG vs FRA',
    msgTimestamp: partial.msgTimestamp ?? new Date().toISOString(),
    ingestTimestamp: new Date().toISOString(),
    confidence: e?.confidence ?? 0.8,
    verdict: 'n/a',
    matchId: '17588316',
    teams: { home: 'Argentina', away: 'France' },
    scoreValue: e?.magnitude,
    rawPayload: { stream: 'scores', fixtureId: 17588316, seq: 1 },
    sources: ['txodds'],
    sourceCount: 1,
    ...partial,
  }
}

const baseConfig: AgentConfig = {
  agentId: 'test-agent',
  enabled: true,
  killSwitch: false,
  mode: 'paper',
  enabledDetectors: ['latency_edge', 'line_velocity', 'model_divergence'],
  edgeThreshold: 40,
  confidenceFloor: 0.55,
  maxPositionSize: 10,
  perMatchCap: 25,
  dailyLossLimit: 50,
}

async function main(): Promise<void> {
  process.env.SIGNAL_AGENT_SIGNING_KEY = 'test-agent-key'
  resetMatchWindows()

  // Disabled → noop
  const off = new AgentEngine({ ...baseConfig, enabled: false })
  const r0 = await off.onSignal(
    signal({
      id: 's0',
      type: 'goal',
      edgeSignal: edge({ magnitude: 70, confidence: 0.9, rationale: 'goal lag' }),
    }),
  )
  assert(r0.kind === 'noop', 'disabled must noop')

  // Kill-switch → stand_down
  const killed = new AgentEngine({ ...baseConfig, killSwitch: true })
  const r1 = await killed.onSignal(
    signal({
      id: 's1',
      type: 'goal',
      edgeSignal: edge({ magnitude: 70, confidence: 0.9, rationale: 'goal lag' }),
    }),
  )
  assert(r1.kind === 'stand_down', 'kill-switch stand_down')
  if (r1.kind === 'stand_down') {
    assert(r1.standDown.reason.includes('kill-switch'), 'kill reason')
  }

  // Sub-threshold → noop (no spam)
  const engine = new AgentEngine(baseConfig)
  const r2 = await engine.onSignal(
    signal({
      id: 's2',
      type: 'odds_shift',
      edgeSignal: edge({ magnitude: 10, confidence: 0.9, rationale: 'tiny' }),
    }),
  )
  assert(r2.kind === 'noop', 'sub-threshold noop')

  // Decision opens
  const r3 = await engine.onSignal(
    signal({
      id: 's3',
      type: 'goal',
      edgeSignal: edge({ magnitude: 70, confidence: 0.9, rationale: 'odds lag after goal' }),
      rawPayload: { stream: 'scores', fixtureId: 17588316, seq: 9, action: 'goal' },
    }),
  )
  assert(r3.kind === 'decision', 'should open decision')
  if (r3.kind !== 'decision') throw new Error('expected decision')
  assert(r3.decision.dataHash.length === 64, 'dataHash sha256')
  assert(r3.decision.mode === 'paper', 'paper mode')
  assert(r3.decision.size > 0 && r3.decision.size <= 10, 'size capped')
  assert(Boolean(r3.decision.signature), 'signed via @cryptocheck/signing')

  // Per-match cap
  engine.updateConfig({ perMatchCap: r3.decision.size, maxPositionSize: 10 })
  const r4 = await engine.onSignal(
    signal({
      id: 's4',
      type: 'goal',
      edgeSignal: edge({ magnitude: 80, confidence: 0.95, rationale: 'another edge' }),
      rawPayload: { stream: 'scores', fixtureId: 17588316, seq: 10 },
    }),
  )
  assert(r4.kind === 'stand_down', 'per-match cap stand_down')

  // Settlement on full_time
  const settleEngine = new AgentEngine(baseConfig)
  const opened = await settleEngine.onSignal(
    signal({
      id: 's5',
      type: 'goal',
      edgeSignal: edge({ magnitude: 70, confidence: 0.9, rationale: 'goal' }),
      rawPayload: { stream: 'scores', seq: 1 },
    }),
  )
  assert(opened.kind === 'decision', 'open for settle')
  const settled = await settleEngine.onSignal(
    signal({
      id: 's6',
      type: 'full_time',
      score: { home: 2, away: 1 },
      edgeSignal: edge({ magnitude: 0, confidence: 0, rationale: 'ft', detectors: [], anomalyOnly: true }),
    }),
  )
  assert(settled.kind === 'settlement', 'settlement emitted')
  if (settled.kind === 'settlement') {
    assert(settled.settlements.length === 1, 'one settlement')
    assert(typeof settled.settlements[0]!.realizedPnl === 'number', 'pnl number')
  }

  // Live evaluator → agent path
  resetMatchWindows()
  const t0 = Date.now()
  evaluateSportsSignal({
    ...signal({
      id: 'live-open',
      type: 'odds_shift',
      msgTimestamp: new Date(t0).toISOString(),
      value: 50,
      rawPayload: { Pct: ['50.000'] },
    }),
  })
  evaluateSportsSignal({
    ...signal({
      id: 'live-m',
      type: 'odds_shift',
      msgTimestamp: new Date(t0 + 2000).toISOString(),
      value: 66,
      rawPayload: { Pct: ['66.000'] },
    }),
  })
  const liveEval = evaluateSportsSignal({
    ...signal({
      id: 'live-goal',
      type: 'goal',
      msgTimestamp: new Date(t0 + 4000).toISOString(),
      score: { home: 1, away: 0 },
      rawPayload: { dataSoccer: { Goal: true }, action: 'goal' },
    }),
  })
  const liveAgent = new AgentEngine({ ...baseConfig, edgeThreshold: 30 })
  const liveDec = await liveAgent.onSignal(
    signal({
      id: 'live-goal',
      type: 'goal',
      edgeSignal: liveEval.edgeSignal,
      scoreValue: liveEval.scoreValue,
      confidence: liveEval.confidence,
      rawPayload: { dataSoccer: { Goal: true }, action: 'goal', seq: 42 },
    }),
  )
  assert(liveDec.kind === 'decision' || liveDec.kind === 'noop', 'live path runs')

  console.log('agent-engine fixtures OK', {
    decisionId: r3.decision.id,
    dataHash: r3.decision.dataHash.slice(0, 12),
    pnl: settled.kind === 'settlement' ? settled.settlements[0]!.realizedPnl : null,
    liveKind: liveDec.kind,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
