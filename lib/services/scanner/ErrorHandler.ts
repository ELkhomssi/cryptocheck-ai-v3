export type ScanErrorCode =
  | 'INVALID_INPUT'
  | 'PIPELINE_STEP_FAILED'
  | 'RPC_UNAVAILABLE'
  | 'CACHE_ERROR'
  | 'UNKNOWN'

export class ScanServiceError extends Error {
  readonly code: ScanErrorCode
  readonly httpStatus: number
  readonly cause?: unknown

  constructor(message: string, code: ScanErrorCode, httpStatus = 500, cause?: unknown) {
    super(message)
    this.name = 'ScanServiceError'
    this.code = code
    this.httpStatus = httpStatus
    this.cause = cause
  }

  toJSON(): { error: string; code: ScanErrorCode } {
    return { error: this.message, code: this.code }
  }
}

/** Maps unknown errors to a safe client payload; logs internally in callers. */
export function normalizeScanError(e: unknown): ScanServiceError {
  if (e instanceof ScanServiceError) return e
  const msg = e instanceof Error ? e.message : 'Scan failed'
  return new ScanServiceError(msg, 'UNKNOWN', 500, e)
}
