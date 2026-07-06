import type { EdgeDetectorHit, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { extractMarket } from './extract-odds.js'
import type { MatchWindow } from './match-state.js'
import {
  clamp,
  decimalFromImpliedProb,
  fmtOdds,
  fmtPct,
  magnitudeFromProbGap,
  probEdge,
} from './odds-math.js'

const LATENCY_WINDOW_MS = Number(process.env.SIGNAL_EDGE_LATENCY_MS ?? 12_000)
const VELOCITY_WINDOW_MS = Number(process.env.SIGNAL_EDGE_VELOCITY_MS ?? 8_000)
const VELOCITY_MIN_MOVE = Number(process.env.SIGNAL_EDGE_VELOCITY_MIN ?? 0.04)
const DIVERGENCE_MIN = Number(process.env.SIGNAL_EDGE_DIVERGENCE_MIN ?? 0.06)
const ANOMALY_Z = Number(process.env.SIGNAL_EDGE_ANOMALY_Z ?? 2.5)

type Market = NonNullable<ReturnType<typeof extractMarket>>

/**
 * 1. Implied probability — baseline market view.
 * Context only (actionable: false); feeds fairValue/marketValue for other detectors.
 */
export function detectImpliedProbability(market: Market): EdgeDetectorHit {
  return {
    detector: 'implied_probability',
    magnitude: clamp(Math.round(Math.abs(market.impliedProb - 0.5) * 40), 5, 25),
    confidence: market.fromPct ? 0.85 : 0.7,
    rationale: `Market implies ${fmtPct(market.impliedProb)} (decimal ${fmtOdds(market.decimalOdds)}${
      market.market ? ` on ${market.market}` : ''
    }) — baseline view after overround-aware normalize.`,
    fairValue: market.decimalOdds,
    marketValue: market.decimalOdds,
    actionable: false,
  }
}

/**
 * Post-event fair-value shift (simple, explainable).
 * Goal / red card / penalty move implied prob by fixed deltas.
 */
function postEventFairProb(
  priorProb: number,
  eventLabel: string,
): { fairProb: number } {
  let delta = 0.06
  const label = eventLabel.toLowerCase()
  if (label.includes('goal')) delta = 0.14
  else if (label.includes('red')) delta = 0.12
  else if (label.includes('penalt')) delta = 0.1

  // Without participant side, shift away from 0.5 toward the prior favorite.
  const direction = priorProb >= 0.5 ? 1 : -1
  const signed = label.includes('red') ? -direction * delta : direction * delta
  const fairProb = clamp(priorProb + signed, 0.05, 0.95)
  return { fairProb }
}

function isLatencyLabel(label: string): boolean {
  const t = label.toLowerCase()
  return t.includes('goal') || t.includes('red') || t.includes('penalt')
}

/**
 * 2. Latency edge — odds lag after goal / red card / penalty.
 * Magnitude = gap between post-event fair value and current (or pre-move) market.
 */
export function detectLatencyEdge(
  window: MatchWindow,
  market: Market | null,
  now: number,
): EdgeDetectorHit | null {
  const ev = window.lastScoreEvent
  if (!ev || !isLatencyLabel(ev.type)) return null

  const ageMs = now - ev.ts
  if (ageMs < 0 || ageMs > LATENCY_WINDOW_MS) return null

  const priorTick = [...window.ticks].reverse().find((t) => t.ts < ev.ts)
  const priorProb = priorTick?.impliedProb ?? window.openingProb
  if (priorProb == null) return null

  const { fairProb } = postEventFairProb(priorProb, ev.type)
  const fairValue = decimalFromImpliedProb(fairProb)
  if (!Number.isFinite(fairValue)) return null

  // Prefer live market; if odds haven't updated yet, use last pre-event tick (pure lag).
  let marketValue: number
  let marketProb: number
  if (market) {
    marketValue = market.decimalOdds
    marketProb = market.impliedProb
  } else if (priorTick) {
    marketValue = priorTick.decimalOdds
    marketProb = priorTick.impliedProb
  } else {
    return null
  }

  const gap = Math.abs(probEdge(fairProb, marketProb))
  if (gap < 0.02) return null

  const ageSec = Math.max(0, Math.round(ageMs / 1000))
  const magnitude = magnitudeFromProbGap(gap)
  const freshness = clamp(1 - ageMs / LATENCY_WINDOW_MS, 0.35, 0.95)

  return {
    detector: 'latency_edge',
    magnitude,
    confidence: freshness,
    rationale: `odds lag ${ageSec}s after the ${ev.type}; fair value implies ${fmtOdds(fairValue)} vs market ${fmtOdds(marketValue)} (${fmtPct(gap)} gap).`,
    fairValue,
    marketValue,
    actionable: true,
  }
}

/**
 * 3. Line-velocity / momentum — sharp odds moves over a short window.
 */
export function detectLineVelocity(window: MatchWindow, market: Market, now: number): EdgeDetectorHit | null {
  const cutoff = now - VELOCITY_WINDOW_MS
  const series = window.ticks.filter((t) => t.ts >= cutoff)
  if (series.length < 2) return null

  const first = series[0]!
  const last = series[series.length - 1]!
  const move = Math.abs(last.impliedProb - first.impliedProb)
  if (move < VELOCITY_MIN_MOVE) return null

  const elapsedSec = Math.max(1, (last.ts - first.ts) / 1000)
  const pctMove = Math.round(move * 100)
  const magnitude = magnitudeFromProbGap(move)
  const speedBoost = clamp(move / (elapsedSec / 4), 0, 1)

  return {
    detector: 'line_velocity',
    magnitude: clamp(Math.round(magnitude * (0.7 + 0.3 * speedBoost)), 0, 100),
    confidence: clamp(0.45 + move * 2, 0.45, 0.9),
    rationale: `odds shifted ${pctMove}% in ${Math.round(elapsedSec)}s (implied ${fmtPct(first.impliedProb)} → ${fmtPct(last.impliedProb)}; market now ${fmtOdds(market.decimalOdds)}).`,
    fairValue: first.decimalOdds,
    marketValue: market.decimalOdds,
    actionable: true,
  }
}

/**
 * 4. Model divergence — live vs opening (opening line = pre-computed fair).
 */
export function detectModelDivergence(window: MatchWindow, market: Market): EdgeDetectorHit | null {
  if (window.openingOdds == null || window.openingProb == null) return null

  const gap = Math.abs(probEdge(window.openingProb, market.impliedProb))
  if (gap < DIVERGENCE_MIN) return null

  return {
    detector: 'model_divergence',
    magnitude: magnitudeFromProbGap(gap),
    confidence: clamp(0.5 + gap, 0.5, 0.88),
    rationale: `live market ${fmtOdds(market.decimalOdds)} diverges from opening fair ${fmtOdds(window.openingOdds)} by ${fmtPct(gap)} (model = opening line).`,
    fairValue: window.openingOdds,
    marketValue: market.decimalOdds,
    actionable: true,
  }
}

/**
 * 5. Anomaly — statistically unusual move (surface only — never act).
 */
export function detectAnomaly(window: MatchWindow, market: Market): EdgeDetectorHit | null {
  const ticks = window.ticks
  if (ticks.length < 6) return null

  const returns: number[] = []
  for (let i = 1; i < ticks.length; i++) {
    returns.push(ticks[i]!.impliedProb - ticks[i - 1]!.impliedProb)
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance =
    returns.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, returns.length - 1)
  const std = Math.sqrt(variance)
  if (std < 1e-6) return null

  const lastRet = returns[returns.length - 1]!
  const z = Math.abs((lastRet - mean) / std)
  if (z < ANOMALY_Z) return null

  return {
    detector: 'anomaly',
    magnitude: clamp(Math.round(z * 18), 20, 100),
    confidence: clamp(0.4 + (z - ANOMALY_Z) * 0.1, 0.4, 0.85),
    rationale: `statistically unusual move (z=${z.toFixed(2)} vs recent ticks); market ${fmtOdds(market.decimalOdds)} — surfaced for integrity, not action.`,
    fairValue: decimalFromImpliedProb(clamp(market.impliedProb - lastRet, 0.05, 0.95)),
    marketValue: market.decimalOdds,
    actionable: false,
  }
}
