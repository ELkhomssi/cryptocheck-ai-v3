export const SCAN_API_ERROR_DOCS_URL = 'https://cryptocheckai.com/api/docs#errors'

export type ApiErrorSeverity = 'low' | 'medium' | 'high'

export type ScanApiErrorPayload = {
  message: string
  code: number
  reason: string
  error: {
    type: 'API_ERROR'
    code: string
    message: string
    severity: ApiErrorSeverity
    docs_url: string
  }
}

export function severityForStatus(status: number): ApiErrorSeverity {
  if (status >= 500) return 'high'
  if (status >= 400) return 'medium'
  return 'low'
}

export function scanApiErrorPayload(
  message: string,
  httpStatus: number,
  publicCode: string,
  opts?: { severity?: ApiErrorSeverity; reason?: string }
): ScanApiErrorPayload {
  const severity = opts?.severity ?? severityForStatus(httpStatus)
  return {
    message,
    code: httpStatus,
    reason: opts?.reason ?? publicCode,
    error: {
      type: 'API_ERROR',
      code: publicCode,
      message,
      severity,
      docs_url: SCAN_API_ERROR_DOCS_URL,
    },
  }
}

export function rateLimitHeaderTriple(rl: { limit: number; remaining: number; reset: number }): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.reset),
  }
}

/** Daily quota headers when present on the scan access context. */
export function mergeWithRateLimitHeaders(
  rateDaily: { limit: number; remaining: number; reset: number } | undefined,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    ...(extra ?? {}),
    ...(rateDaily ? rateLimitHeaderTriple(rateDaily) : {}),
  }
}
