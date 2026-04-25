import { scanApiErrorPayload, type ApiErrorSeverity, type ScanApiErrorPayload } from '@/lib/api/scan-api-errors'

export type ScanErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_MINT_ADDRESS'
  | 'MISSING_TIMESTAMP'
  | 'INVALID_TIMESTAMP'
  | 'REQUEST_EXPIRED'
  | 'SIGNATURE_REQUIRES_API_KEY'
  | 'INVALID_SIGNATURE'
  | 'SIGNING_MISCONFIGURED'
  | 'IP_NOT_ALLOWED'
  | 'RATE_LIMIT'
  | 'PIPELINE_STEP_FAILED'
  | 'RPC_UNAVAILABLE'
  | 'CACHE_ERROR'
  | 'UNKNOWN'

export class ScanServiceError extends Error {
  readonly code: ScanErrorCode
  readonly httpStatus: number
  readonly cause?: unknown
  readonly publicCode: string
  readonly severity: ApiErrorSeverity

  constructor(
    message: string,
    code: ScanErrorCode,
    httpStatus = 500,
    cause?: unknown,
    publicCode?: string,
    severity?: ApiErrorSeverity
  ) {
    super(message)
    this.name = 'ScanServiceError'
    this.code = code
    this.httpStatus = httpStatus
    this.cause = cause
    this.publicCode = publicCode ?? code
    const sev = severity ?? undefined
    this.severity = sev ?? (httpStatus >= 500 ? 'high' : httpStatus >= 400 ? 'medium' : 'low')
  }

  toJSON(): ScanApiErrorPayload {
    return scanApiErrorPayload(this.message, this.httpStatus, this.publicCode, {
      severity: this.severity,
      reason: this.code,
    })
  }
}

/** Maps unknown errors to a safe client payload; logs internally in callers. */
export function normalizeScanError(e: unknown): ScanServiceError {
  if (e instanceof ScanServiceError) return e
  const msg = e instanceof Error ? e.message : 'Scan failed'
  return new ScanServiceError(msg, 'UNKNOWN', 500, e, 'UNKNOWN')
}
