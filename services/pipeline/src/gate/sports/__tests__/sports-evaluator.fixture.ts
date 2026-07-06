/**
 * Fixture-style checks for SportsSignalEvaluator (Prompt A).
 * Run: npx tsx src/gate/sports/__tests__/sports-evaluator.fixture.ts
 */
import { evaluateSportsSignal, resetMatchWindows } from '../../sports-evaluator.js'
import type { UnifiedSignal } from '@cryptocheck/signal-contracts'

function base(partial: Partial<UnifiedSignal> & Pick<UnifiedSignal, 'id' | 'type'>): UnifiedSignal {
  return {
    sourceTag: 'txodds',
    sourceRef: partial.id,
    subjectType: 'match_event',
    label: 'ARG vs FRA',
    msgTimestamp: partial.msgTimestamp ?? new Date().toISOString(),
    ingestTimestamp: new Date().toISOString(),
    confidence: 1,
    verdict: 'scanning',
    matchId: '17588316',
    teams: { home: 'Argentina', away: 'France' },
    rawPayload: {},
    sources: ['txodds'],
    sourceCount: 1,
    ...partial,
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

resetMatchWindows()

// Opening odds tick
const t0 = Date.now()
const open = evaluateSportsSignal(
  base({
    id: 'txodds:17588316:open',
    type: 'odds_shift',
    msgTimestamp: new Date(t0).toISOString(),
    value: 50,
    market: '1X2 · Home',
    rawPayload: { stream: 'odds', Pct: ['50.000'], SuperOddsType: '1X2' },
  }),
)
assert(open.verdict === 'n/a', 'verdict must be n/a')
assert(open.edgeSignal.detectors.some((d) => d.detector === 'implied_probability'), 'implied prob')

// Sharp move (velocity)
const t1 = t0 + 3000
evaluateSportsSignal(
  base({
    id: 'txodds:17588316:m1',
    type: 'odds_shift',
    msgTimestamp: new Date(t1).toISOString(),
    value: 55,
    rawPayload: { stream: 'odds', Pct: ['55.000'] },
  }),
)
const vel = evaluateSportsSignal(
  base({
    id: 'txodds:17588316:m2',
    type: 'odds_shift',
    msgTimestamp: new Date(t1 + 2000).toISOString(),
    value: 68,
    rawPayload: { stream: 'odds', Pct: ['68.000'] },
  }),
)
assert(vel.edgeSignal.detectors.some((d) => d.detector === 'line_velocity'), 'line velocity')
assert(vel.edgeSignal.rationale.length > 20, 'rationale required')
assert(vel.scoreValue === vel.edgeSignal.magnitude, 'scoreValue = magnitude')

// Goal → latency edge vs stale market
const tGoal = t1 + 5000
const goal = evaluateSportsSignal(
  base({
    id: 'txodds:17588316:goal',
    type: 'goal',
    msgTimestamp: new Date(tGoal).toISOString(),
    score: { home: 1, away: 0 },
    rawPayload: { stream: 'scores', dataSoccer: { Goal: true }, action: 'goal' },
  }),
)
assert(goal.edgeSignal.detectors.some((d) => d.detector === 'latency_edge'), 'latency after goal')
assert(goal.edgeSignal.rationale.toLowerCase().includes('goal'), 'goal in rationale')

// Anomaly-only must not be actionable primary when only anomaly fires — anomaly is non-actionable
const anomalyHits = goal.edgeSignal.detectors.filter((d) => d.detector === 'anomaly')
for (const h of anomalyHits) {
  assert(h.actionable === false, 'anomaly never actionable')
}

console.log('sports-evaluator fixtures OK', {
  openMag: open.scoreValue,
  velMag: vel.scoreValue,
  goalMag: goal.scoreValue,
  goalRationale: goal.edgeSignal.rationale.slice(0, 120),
})
