/**
 * Step 1 — normalize heterogeneous inputs to 0–1 floats for weighted heuristic.
 */

export type RawCopilotSignals = {
  neuralScore: number
  /** Relative velocity: e.g. (vol24h / liquidityUsd) capped upstream */
  liquidityVelocity: number
  mintRenounced: boolean
  freezeActive: boolean
  metadataMutable: boolean
  top1Pct: number
  /** e.g. recent vol vs baseline; 1 = neutral */
  volumeSpike: number
}

export type NormalizedCopilotSignals = {
  neural: number
  liqStability: number
  authorityRisk: number
  holderSkew: number
  flowHeat: number
}

export function normalizeCopilotSignals(raw: RawCopilotSignals): NormalizedCopilotSignals {
  const neural = Math.max(0, Math.min(1, raw.neuralScore / 100))
  const liqVel = Math.max(0, Math.min(1, raw.liquidityVelocity))
  const liqStability = 1 - liqVel
  let authorityRisk = 0
  if (!raw.mintRenounced) authorityRisk += 0.45
  if (raw.freezeActive) authorityRisk += 0.35
  if (raw.metadataMutable) authorityRisk += 0.2
  authorityRisk = Math.max(0, Math.min(1, authorityRisk))
  const holderSkew = Math.max(0, Math.min(1, raw.top1Pct / 100))
  const flowHeat = Math.max(0, Math.min(1, (raw.volumeSpike - 1) / 4 + 0.5))
  return { neural, liqStability, authorityRisk, holderSkew, flowHeat }
}
