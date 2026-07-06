/**
 * SportsSignalEvaluator — explainable edge detection for match_event UnifiedSignals.
 * Sentinel Edge Prompt A. NEVER enters the Jupiter swap path.
 *
 * Detectors: implied probability, latency edge, line-velocity, model divergence, anomaly.
 * Verdict stays `n/a` (separate from crypto risk). scoreValue = EdgeSignal.magnitude.
 */
import type {
  EdgeDetectorHit,
  EdgeSignal,
  UnifiedSignal,
  UnifiedVerdict,
} from '@cryptocheck/signal-contracts'
import {
  detectAnomaly,
  detectImpliedProbability,
  detectLatencyEdge,
  detectLineVelocity,
  detectModelDivergence,
} from './sports/detectors.js'
import {
  extractMarket,
  isLatencyTriggerEvent,
  isScoreLikeEvent,
  latencyEventLabel,
} from './sports/extract-odds.js'
import {
  getMatchWindow,
  recordOddsTick,
  recordScoreEvent,
  resetMatchWindows,
  seedMatchWindow,
} from './sports/match-state.js'
import { clamp } from './sports/odds-math.js'

export type SportsEvalResult = {
  verdict: Extract<UnifiedVerdict, 'n/a'>
  /** Edge magnitude 0–100 — attached as UnifiedSignal.scoreValue. */
  scoreValue: number
  /** 0–1 — attached as UnifiedSignal.confidence when edge present. */
  confidence: number
  edgeSignal: EdgeSignal
}

function signalTsMs(signal: UnifiedSignal): number {
  const t = Date.parse(signal.msgTimestamp)
  return Number.isFinite(t) ? t : Date.now()
}

function updateWindow(signal: UnifiedSignal, now: number): void {
  const matchId = signal.matchId
  if (!matchId) return

  if (isScoreLikeEvent(signal)) {
    recordScoreEvent(matchId, {
      ts: now,
      type: isLatencyTriggerEvent(signal) ? latencyEventLabel(signal) : String(signal.type),
      score: signal.score,
    })
  }

  const market = extractMarket(signal)
  if (market) {
    recordOddsTick(matchId, {
      ts: now,
      decimalOdds: market.decimalOdds,
      impliedProb: market.impliedProb,
      market: market.market,
    })
  }
}

function combineDetectors(hits: EdgeDetectorHit[], nowIso: string): EdgeSignal {
  const actionable = hits.filter((h) => h.actionable)
  const primaryPool = actionable.length > 0 ? actionable : hits

  primaryPool.sort((a, b) => b.magnitude * b.confidence - a.magnitude * a.confidence)
  const top = primaryPool[0]

  if (!top) {
    return {
      magnitude: 0,
      confidence: 0,
      rationale: 'No edge detectors fired.',
      fairValue: 0,
      marketValue: 0,
      detectors: hits,
      anomalyOnly: true,
      evaluatedAt: nowIso,
    }
  }

  // Agreement boost when multiple actionable detectors fire
  const agreement =
    actionable.length <= 1 ? 0 : clamp((actionable.length - 1) * 0.08, 0, 0.2)

  const magnitude = top.magnitude
  const confidence = clamp(top.confidence + agreement, 0, 1)

  const rationaleParts = primaryPool
    .slice(0, 3)
    .map((h) => h.rationale)
  const rationale = rationaleParts.join(' ')

  const anomalyOnly = actionable.length === 0 && hits.some((h) => h.detector === 'anomaly')

  return {
    magnitude,
    confidence,
    rationale,
    fairValue: top.fairValue ?? 0,
    marketValue: top.marketValue ?? 0,
    side: 'unknown',
    detectors: hits,
    anomalyOnly,
    evaluatedAt: nowIso,
  }
}

function emptyEdge(nowIso: string, rationale: string): EdgeSignal {
  return {
    magnitude: 0,
    confidence: 0,
    rationale,
    fairValue: 0,
    marketValue: 0,
    detectors: [],
    anomalyOnly: true,
    evaluatedAt: nowIso,
  }
}

/**
 * Evaluate a match_event signal. Updates per-match window, runs detectors, returns EdgeSignal.
 * Callers attach edgeSignal + scoreValue to UnifiedSignal; verdict remains `n/a`.
 */
export function evaluateSportsSignal(signal: UnifiedSignal): SportsEvalResult {
  const nowIso = new Date().toISOString()
  const now = signalTsMs(signal)

  if (signal.subjectType !== 'match_event') {
    const edge = emptyEdge(nowIso, 'Not a match_event — sports evaluator skipped.')
    return { verdict: 'n/a', scoreValue: 0, confidence: 0, edgeSignal: edge }
  }

  const matchId = signal.matchId
  if (!matchId) {
    const edge = emptyEdge(nowIso, 'Missing matchId — cannot evaluate edge.')
    return { verdict: 'n/a', scoreValue: 0, confidence: 0, edgeSignal: edge }
  }

  updateWindow(signal, now)
  const window = getMatchWindow(matchId)!
  const market = extractMarket(signal)
  const hits: EdgeDetectorHit[] = []

  if (market) {
    hits.push(detectImpliedProbability(market))
  }

  const latency = detectLatencyEdge(window, market, now)
  if (latency) hits.push(latency)

  if (market) {
    const velocity = detectLineVelocity(window, market, now)
    if (velocity) hits.push(velocity)

    const divergence = detectModelDivergence(window, market)
    if (divergence) hits.push(divergence)

    const anomaly = detectAnomaly(window, market)
    if (anomaly) hits.push(anomaly)
  }

  // Score-only event with no prior odds: still surface a minimal latency context if trigger
  if (!market && isLatencyTriggerEvent(signal) && hits.length === 0) {
    hits.push({
      detector: 'latency_edge',
      magnitude: 35,
      confidence: 0.4,
      rationale: `${latencyEventLabel(signal)} observed; awaiting market re-price to quantify lag edge.`,
      actionable: true,
    })
  }

  const edgeSignal = combineDetectors(hits, nowIso)

  return {
    verdict: 'n/a',
    scoreValue: edgeSignal.magnitude,
    confidence: edgeSignal.confidence > 0 ? edgeSignal.confidence : signal.confidence,
    edgeSignal,
  }
}

/** Backtest / tests — re-export window controls. */
export { resetMatchWindows, seedMatchWindow }
