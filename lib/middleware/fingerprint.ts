import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

export type FingerprintRiskFlag = 'LOW' | 'MEDIUM' | 'HIGH' | 'SUSPICIOUS'

/** Trust / device context for zero-trust analytics (does not replace auth). */
export type RequestFingerprint = {
  device_id: string
  trust_score: number
  risk_flag: FingerprintRiskFlag
  /** Primary client IP (CF first when present). */
  client_ip: string | null
  /** Comma-separated forwarded chain, if any. */
  forwarded_for: string | null
  user_agent: string | null
  /** TLS / JA3 not available in Next Request — reserved for edge proxies. */
  tls_fingerprint_available: boolean
}

function pickClientIp(req: NextRequest): { cf: string | null; xff: string | null; primary: string | null } {
  const cf = req.headers.get('cf-connecting-ip')?.trim() || null
  const xffRaw = req.headers.get('x-forwarded-for')?.trim() || null
  const xff = xffRaw ? xffRaw.split(',')[0]?.trim() || null : null
  const real = req.headers.get('x-real-ip')?.trim() || null
  const primary = cf || xff || real || null
  return { cf, xff: xffRaw, primary }
}

/**
 * Stable device identifier: SHA-256 over IP entropy + User-Agent (fast, no external deps).
 * TLS client fingerprint is not exposed by Next.js; we flag `tls_fingerprint_available: false`.
 */
function computeDeviceId(cf: string | null, xff: string | null, ua: string | null): string {
  const ipEntropy = [cf, xff].filter(Boolean).join('|') || 'unknown'
  const material = `${ipEntropy}::${ua ?? ''}`
  return createHash('sha256').update(material, 'utf8').digest('hex').slice(0, 40)
}

/**
 * Deterministic trust score (0–100) from lightweight signals. Tuned for abuse hints only.
 */
function trustScore(input: { client_ip: string | null; user_agent: string | null; cf: string | null; xff: string | null }): number {
  let score = 88
  const ua = input.user_agent?.trim() || ''
  if (!ua) score -= 28
  else if (/^curl|^wget|^python|^axios|^go-http/i.test(ua)) score -= 12
  else if (ua.length < 20) score -= 8

  if (!input.client_ip) score -= 25
  if (input.cf && input.xff && !input.xff.includes(input.cf)) score -= 10

  return Math.max(0, Math.min(100, Math.round(score)))
}

function riskFromScore(s: number): FingerprintRiskFlag {
  if (s >= 76) return 'LOW'
  if (s >= 52) return 'MEDIUM'
  if (s >= 28) return 'HIGH'
  return 'SUSPICIOUS'
}

/**
 * Build fingerprint context from inbound request headers.
 * Call at the start of protected route handlers; no global mutable state.
 */
/** Narrow payload for API responses / logging (matches institutional contract). */
export function institutionalFingerprintPayload(fp: RequestFingerprint): {
  device_id: string
  trust_score: number
  risk_flag: FingerprintRiskFlag
} {
  return {
    device_id: fp.device_id,
    trust_score: fp.trust_score,
    risk_flag: fp.risk_flag,
  }
}

export function getRequestFingerprint(req: NextRequest): RequestFingerprint {
  const { cf, xff, primary } = pickClientIp(req)
  const user_agent = req.headers.get('user-agent')
  const device_id = computeDeviceId(cf, xff, user_agent)
  const trust_score = trustScore({ client_ip: primary, user_agent, cf, xff })
  const risk_flag = riskFromScore(trust_score)

  return {
    device_id,
    trust_score,
    risk_flag,
    client_ip: primary,
    forwarded_for: xff,
    user_agent,
    tls_fingerprint_available: false,
  }
}
