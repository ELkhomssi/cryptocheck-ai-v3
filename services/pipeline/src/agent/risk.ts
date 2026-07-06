import type { AgentConfig, DecisionSide, EdgeSignal, UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { AgentStore } from './store.js'

export type RiskOk = { ok: true; size: number; side: DecisionSide }
export type RiskStandDown = { ok: false; reason: string }
export type RiskCheck = RiskOk | RiskStandDown

export function inferSide(signal: UnifiedSignal, edge: EdgeSignal): DecisionSide {
  if (edge.side && edge.side !== 'over' && edge.side !== 'under' && edge.side !== 'unknown') {
    return edge.side
  }
  const t = String(signal.type)
  if (t === 'back') return 'back'
  if (t === 'lay') return 'lay'
  // Shorter fair odds than market → model likes this selection (back)
  if (edge.fairValue > 0 && edge.marketValue > 0 && edge.fairValue < edge.marketValue) {
    return 'back'
  }
  if (edge.fairValue > edge.marketValue) return 'lay'
  return 'back'
}

export function checkRiskCaps(
  config: AgentConfig,
  store: AgentStore,
  signal: UnifiedSignal,
  edge: EdgeSignal,
): RiskCheck {
  if (!config.enabled) {
    return { ok: false, reason: 'agent disabled (opt-in required: SIGNAL_AGENT_ENABLED=true)' }
  }
  if (config.killSwitch) {
    return { ok: false, reason: 'kill-switch active — all new decisions halted' }
  }

  if (edge.anomalyOnly) {
    return { ok: false, reason: 'anomaly-only edge — surface, do not act' }
  }

  const actionable = edge.detectors.filter(
    (d) => d.actionable && config.enabledDetectors.includes(d.detector),
  )
  if (actionable.length === 0) {
    return { ok: false, reason: 'no enabled actionable detectors fired' }
  }

  if (edge.magnitude < config.edgeThreshold) {
    return {
      ok: false,
      reason: `edge magnitude ${edge.magnitude} < threshold ${config.edgeThreshold}`,
    }
  }
  if (edge.confidence < config.confidenceFloor) {
    return {
      ok: false,
      reason: `confidence ${edge.confidence.toFixed(2)} < floor ${config.confidenceFloor}`,
    }
  }

  const matchId = signal.matchId
  if (!matchId) return { ok: false, reason: 'missing matchId' }

  const day = store.getDay()
  if (day.realizedPnl <= -Math.abs(config.dailyLossLimit)) {
    return {
      ok: false,
      reason: `daily loss limit hit (pnl=${day.realizedPnl.toFixed(2)}, limit=${config.dailyLossLimit})`,
    }
  }

  const exposure = store.openExposureForMatch(matchId)
  if (exposure >= config.perMatchCap) {
    return {
      ok: false,
      reason: `per-match cap hit (exposure=${exposure}, cap=${config.perMatchCap})`,
    }
  }

  const room = config.perMatchCap - exposure
  const size = Math.min(config.maxPositionSize, room)
  if (size <= 0) {
    return { ok: false, reason: 'no size room under caps' }
  }

  // Scale size lightly with confidence (still ≤ max)
  const sized = Math.max(1, Math.round(size * (0.5 + 0.5 * edge.confidence)))
  const finalSize = Math.min(sized, size)

  return { ok: true, size: finalSize, side: inferSide(signal, edge) }
}
