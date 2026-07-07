import type { UnifiedSignal } from '@cryptocheck/signal-contracts'
import type { TokenCallType } from '@cryptocheck/signal-contracts'
import type { AssessResult } from '../enrich/assess-client.js'

export type ProofEngineConfig = {
  enabled: boolean
  dryRun: boolean
  autoPost: boolean
  dangerMaxSafetyScore: number
  safeMinSafetyScore: number
  smartMoneyMinSources: number
  gradeIntervalMs: number
}

export function loadProofEngineConfig(): ProofEngineConfig {
  const enabled = process.env.PROOF_ENGINE_ENABLED === 'true'
  return {
    enabled,
    dryRun: process.env.PROOF_ENGINE_DRY_RUN !== 'false' && enabled,
    autoPost: process.env.PROOF_ENGINE_AUTO_POST === 'true',
    dangerMaxSafetyScore: Number(process.env.PROOF_ENGINE_DANGER_MAX_SCORE ?? 25),
    safeMinSafetyScore: Number(process.env.PROOF_ENGINE_SAFE_MIN_SCORE ?? 80),
    smartMoneyMinSources: Number(process.env.PROOF_ENGINE_SMART_MONEY_MIN_SOURCES ?? 3),
    gradeIntervalMs: Number(process.env.PROOF_ENGINE_GRADE_INTERVAL_MS ?? 900_000),
  }
}

export type CallSelection = {
  callType: TokenCallType
  evidenceSummary: string
}

export function selectTokenCall(
  signal: UnifiedSignal,
  assessment: AssessResult,
  cfg: ProofEngineConfig,
): CallSelection | null {
  if (signal.subjectType !== 'token' || signal.dropped || signal.sample) return null
  if (!assessment.resolved || assessment.dropped) return null

  const score = assessment.neuralScore ?? signal.scoreValue ?? 0
  const risk = assessment.riskScore ?? Math.max(0, 100 - score)
  const sources = signal.sourceCount ?? 1

  if (signal.verdict === 'danger' && score <= cfg.dangerMaxSafetyScore) {
    return {
      callType: 'rug_alert',
      evidenceSummary: `Neural score ${score}/100 · elevated rug risk (${risk}/100)`,
    }
  }

  if (signal.verdict === 'safe' && score >= cfg.safeMinSafetyScore) {
    return {
      callType: 'safe_entry',
      evidenceSummary: `Neural score ${score}/100 · SAFE verdict with strong safety band`,
    }
  }

  if (
    (signal.type === 'buy' || sources >= cfg.smartMoneyMinSources) &&
    sources >= cfg.smartMoneyMinSources &&
    signal.verdict !== 'danger'
  ) {
    return {
      callType: 'smart_money',
      evidenceSummary: `Smart money cluster · ${sources} sources · ${signal.type} signal`,
    }
  }

  return null
}
