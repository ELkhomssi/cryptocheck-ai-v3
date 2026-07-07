/**
 * Shared contract for the Scanner microservice (services/scanner).
 * Consumed by the Sniper engine + dashboard. The scanner reuses the frozen
 * risk core via the gateway (POST /api/internal/signals/assess) for the
 * authoritative score, and adds an independent direct-Helius kill-switch
 * (mint/freeze authority) so red flags are detected even if the app is down.
 */

export type ScanVerdict = 'SAFE' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED'

/** Hard red flags — ANY present means the Sniper kill-switch blocks the buy. */
export type ScanRedFlag =
  | 'MINT_AUTHORITY_ACTIVE'
  | 'FREEZE_AUTHORITY_ACTIVE'
  | 'HONEYPOT'
  | 'HIGH_RISK_VERDICT'
  | 'BLOCKED_VERDICT'
  | 'UNRESOLVED'

/** Where the authoritative parts of the report came from. */
export type ScanSource = 'gateway+helius' | 'gateway' | 'helius-only' | 'degraded'

export type ScanReport = {
  mint: string
  ok: boolean
  /** 0..100 safety (higher = safer) — mirrors gateway safetyScore / neuralScore. */
  neuralScore: number
  /** 0..100 risk (higher = riskier). */
  riskScore: number
  verdict: ScanVerdict
  redFlags: ScanRedFlag[]
  mintAuthorityActive: boolean | null
  freezeAuthorityActive: boolean | null
  honeypot: boolean | null
  evidenceSummary: string
  /**
   * Kill-switch result. true ONLY when the token resolved AND there are zero
   * red flags. The Sniper must never buy when this is false.
   */
  safeToSnipe: boolean
  source: ScanSource
  scannedAt: string
  latencyMs: number
}

export type ScanRequest = {
  mint: string
  /** fast (<3s, default) or institutional (adds canonical overlay, slower). */
  depth?: 'fast' | 'institutional'
}
