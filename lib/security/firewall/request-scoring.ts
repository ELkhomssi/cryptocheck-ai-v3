/**
 * Request scoring firewall — pure synchronous evaluation (no I/O).
 * Pre-fetch Redis / DB in the caller, then pass aggregates here for sub-millisecond scoring (p99 safe when I/O is outside this call).
 */

export type FirewallDecision = 'ALLOW' | 'THROTTLE' | 'BLOCK'

/** Stable machine codes for audit and dashboards */
export const FirewallReasonCode = {
  KEY_REVOKED: 'FW_KEY_REVOKED',
  KEY_UNKNOWN: 'FW_KEY_UNKNOWN',
  KEY_ROTATING: 'FW_KEY_ROTATING_ELEVATED_RISK',
  SIG_INVALID: 'FW_SIGNATURE_INVALID',
  SIG_MISSING_REQUIRED: 'FW_SIGNATURE_MISSING',
  TRUST_LOW: 'FW_DEVICE_TRUST_LOW',
  TRUST_MEDIUM: 'FW_DEVICE_TRUST_MEDIUM',
  RATE_NEAR_EXHAUST: 'FW_RATE_LIMIT_NEAR_EXHAUST',
  RATE_PRESSURE: 'FW_RATE_LIMIT_PRESSURE',
  BURST_HIGH: 'FW_BURST_ANOMALY',
  GEO_ANOMALY: 'FW_GEO_ANOMALY',
  HISTORY_VOLUME: 'FW_HISTORICAL_VOLUME_SPIKE',
  HISTORY_ERRORS: 'FW_HISTORICAL_ERROR_RUN',
  SESSION_UNAUTH: 'FW_SESSION_CONTEXT',
} as const

export type FirewallReason = (typeof FirewallReasonCode)[keyof typeof FirewallReasonCode]

export type KeySchema = 'v1' | 'v2' | 'none'

export type KeyLifecycleStatus = 'active' | 'rotating' | 'revoked' | 'unknown'

/**
 * Signature gate for API-key routes: HMAC not applicable (browser), OK, bad, or absent when required.
 */
export type SignatureEvaluation = 'not_applicable' | 'valid' | 'invalid' | 'missing_required'

export type RequestScoringInput = {
  /** Which key material was validated, if any */
  keySchema: KeySchema
  keyStatus?: KeyLifecycleStatus
  signature: SignatureEvaluation
  /** Device fingerprint trust (0–100); omit if not computed */
  deviceTrustScore?: number
  /** Rate limiter snapshot: remaining units in current window (e.g. daily or sliding) */
  rateLimitRemaining?: number
  rateLimitLimit?: number
  /** Burst: current window utilization 0–1 (e.g. instant bucket fullness / capacity) */
  burstUtilization?: number
  /** Geo anomaly 0–100 from edge/GeoIP rules; higher = worse */
  geoAnomalyScore?: number
  /** Rolling 1m request count for this identity (from Redis); compare to softQuota */
  redisRequestsLast1m?: number
  /** Tier-expected soft ceiling for 1m (optional) */
  softQuotaRequestsPer1m?: number
  /** Error count in rolling 15m window from Redis */
  redisErrorsLast15m?: number
  /** Unauthenticated browser path — lower baseline trust */
  isAnonymousSession?: boolean
}

export type RequestScoringResult = {
  /** 100 = full trust; 0 = block */
  score: number
  decision: FirewallDecision
  reason_codes: FirewallReason[]
}

export type FirewallScoringConfig = {
  /** score &gt;= allowMin → ALLOW */
  allowMin: number
  /** throttleMin &lt;= score &lt; allowMin → THROTTLE */
  throttleMin: number
}

const DEFAULT_CONFIG: FirewallScoringConfig = {
  allowMin: 72,
  throttleMin: 38,
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Deterministic firewall score. Runs in O(1); safe to call per request on hot path.
 */
export function scoreRequest(
  input: RequestScoringInput,
  config: Partial<FirewallScoringConfig> = {}
): RequestScoringResult {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const reasons: FirewallReason[] = []
  let score = 100

  if (input.keyStatus === 'revoked') {
    return {
      score: 0,
      decision: 'BLOCK',
      reason_codes: [FirewallReasonCode.KEY_REVOKED],
    }
  }

  if (input.keySchema !== 'none' && input.keyStatus === 'unknown') {
    score -= 35
    reasons.push(FirewallReasonCode.KEY_UNKNOWN)
  }

  if (input.keySchema === 'v2' && input.keyStatus === 'rotating') {
    score -= 6
    reasons.push(FirewallReasonCode.KEY_ROTATING)
  }

  switch (input.signature) {
    case 'invalid':
      score -= 46
      reasons.push(FirewallReasonCode.SIG_INVALID)
      break
    case 'missing_required':
      score -= 52
      reasons.push(FirewallReasonCode.SIG_MISSING_REQUIRED)
      break
    default:
      break
  }

  if (input.deviceTrustScore != null) {
    const t = clamp(input.deviceTrustScore, 0, 100)
    if (t < 32) {
      score -= 26
      reasons.push(FirewallReasonCode.TRUST_LOW)
    } else if (t < 52) {
      score -= 14
      reasons.push(FirewallReasonCode.TRUST_MEDIUM)
    } else if (t < 70) {
      score -= 5
    }
  }

  if (
    input.rateLimitRemaining != null &&
    input.rateLimitLimit != null &&
    input.rateLimitLimit > 0
  ) {
    const ratio = input.rateLimitRemaining / input.rateLimitLimit
    if (ratio < 0.04) {
      score -= 22
      reasons.push(FirewallReasonCode.RATE_NEAR_EXHAUST)
    } else if (ratio < 0.12) {
      score -= 10
      reasons.push(FirewallReasonCode.RATE_PRESSURE)
    }
  }

  if (input.burstUtilization != null) {
    const b = clamp(input.burstUtilization, 0, 1)
    if (b > 0.92) {
      score -= 24
      reasons.push(FirewallReasonCode.BURST_HIGH)
    } else if (b > 0.78) {
      score -= 11
      reasons.push(FirewallReasonCode.BURST_HIGH)
    }
  }

  if (input.geoAnomalyScore != null) {
    const g = clamp(input.geoAnomalyScore, 0, 100)
    if (g > 72) {
      const pen = Math.round(g * 0.22)
      score -= pen
      reasons.push(FirewallReasonCode.GEO_ANOMALY)
    }
  }

  if (
    input.redisRequestsLast1m != null &&
    input.softQuotaRequestsPer1m != null &&
    input.softQuotaRequestsPer1m > 0
  ) {
    const volRatio = input.redisRequestsLast1m / input.softQuotaRequestsPer1m
    if (volRatio > 2.4) {
      score -= 18
      reasons.push(FirewallReasonCode.HISTORY_VOLUME)
    } else if (volRatio > 1.6) {
      score -= 9
      reasons.push(FirewallReasonCode.HISTORY_VOLUME)
    }
  }

  if (input.redisErrorsLast15m != null && input.redisErrorsLast15m >= 8) {
    score -= Math.min(28, 4 + input.redisErrorsLast15m)
    reasons.push(FirewallReasonCode.HISTORY_ERRORS)
  }

  if (input.isAnonymousSession) {
    score -= 4
    reasons.push(FirewallReasonCode.SESSION_UNAUTH)
  }

  score = clamp(Math.round(score), 0, 100)

  let decision: FirewallDecision
  if (score >= cfg.allowMin) {
    decision = 'ALLOW'
  } else if (score >= cfg.throttleMin) {
    decision = 'THROTTLE'
  } else {
    decision = 'BLOCK'
  }

  const uniq = [...new Set(reasons)]
  return { score, decision, reason_codes: uniq }
}
