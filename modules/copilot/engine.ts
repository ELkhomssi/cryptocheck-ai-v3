import { normalizeCopilotSignals, type RawCopilotSignals } from '@/lib/data-normalizer'
import type { CopilotDecisionJson } from '@/modules/copilot/types'

const W = {
  neural: 0.32,
  liqStability: 0.22,
  authority: -0.36,
  holder: -0.14,
  flow: 0.08,
}

/**
 * Steps 2–3: weighted heuristic + deterministic decision rules.
 * Reasoning uses ONLY normalized signal phrases (no LLM).
 */
export function runCopilotDecision(raw: RawCopilotSignals): CopilotDecisionJson {
  const n = normalizeCopilotSignals(raw)
  const score =
    W.neural * n.neural +
    W.liqStability * n.liqStability +
    W.authority * n.authorityRisk +
    W.holder * n.holderSkew +
    W.flow * n.flowHeat
  const score01 = Math.max(0, Math.min(1, (score + 0.35) / 1.1))
  const score100 = Math.round(score01 * 100)

  const liqStable = n.liqStability >= 0.55
  const noAuthorityRisk = n.authorityRisk < 0.35

  let action: CopilotDecisionJson['action'] = 'WAIT'
  if (score100 > 80 && liqStable && noAuthorityRisk) action = 'BUY'
  else if (n.authorityRisk >= 0.45 || n.liqStability < 0.35) action = 'AVOID'
  else if (score100 >= 60 && score100 <= 80) action = 'WAIT'
  else if (score100 < 60) action = 'AVOID'

  const parts: string[] = []
  parts.push(`Neural ${raw.neuralScore}/100`)
  parts.push(raw.mintRenounced ? 'mint renounced' : 'mint authority live')
  parts.push(raw.freezeActive ? 'freeze on' : 'no freeze')
  parts.push(raw.metadataMutable ? 'metadata mutable' : 'metadata fixed')
  parts.push(`top-1 ${raw.top1Pct.toFixed(1)}%`)
  parts.push(`liq/flow stress ${(raw.liquidityVelocity * 100).toFixed(0)}bps`)

  const band = action === 'BUY' ? 4 : action === 'WAIT' ? 10 : 18
  const lo = Math.max(0, score100 - band)
  const hi = Math.min(100, score100 + Math.round(band * 0.6))
  const entry_range: [number, number] = [lo, hi]

  const exit_window =
    action === 'BUY'
      ? 'Tighten if liquidity velocity rises or score < 72 within 24h'
      : action === 'WAIT'
        ? 'Re-evaluate on next volume spike or authority change'
        : 'No new exposure; reduce if already positioned'

  const confidence = Math.max(0, Math.min(100, score100))

  return {
    action,
    confidence,
    entry_range,
    exit_window,
    reasoning: parts.join(' · '),
  }
}
