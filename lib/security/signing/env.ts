/**
 * SENTINEL signing — environment invariants (no cryptographic primitives).
 * Safe for Next.js instrumentation bootstrap (no `crypto` import).
 */

/** Public docs fragment (no environment secrets). */
export const SCAN_API_SECURITY_DOCS_URL = 'https://cryptocheckai.com/api/docs#security'

/**
 * Dev-only fallback when `API_SIGNING_SALT` is unset outside production.
 * MUST NOT be used in production (enforced at startup and per-request).
 *
 * Client SDKs may also read `CRYPTOCHECK_SIGNING_SALT` (see `lib/sdk/cryptocheck-sdk.ts`) but the server
 * only uses `API_SIGNING_SALT` here — keep them identical in production.
 */
export const SCAN_API_DOCS_DEV_SIGNING_SALT = 'cryptocheck_dev_api_signing_salt_v1'

/**
 * Process must exit / server must not start if thrown during instrumentation.
 */
export class FatalSentinelSigningMisconfiguration extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FatalSentinelSigningMisconfiguration'
  }
}

/**
 * Request-time configuration failure → HTTP 500 with flat JSON body (no env leakage).
 */
export class SentinelServerMisconfigurationError extends Error {
  constructor() {
    super('CryptoCheck security system misconfigured. Contact support immediately.')
    this.name = 'SentinelServerMisconfigurationError'
  }

  toResponseBody(): {
    type: 'SERVER_MISCONFIGURATION'
    code: 500
    severity: 'critical'
    message: string
    docs_url: string
  } {
    return {
      type: 'SERVER_MISCONFIGURATION',
      code: 500,
      severity: 'critical',
      message: 'CryptoCheck security system misconfigured. Contact support immediately.',
      docs_url: SCAN_API_SECURITY_DOCS_URL,
    }
  }
}

/** @returns fatal message, or null when configuration is acceptable for production. */
export function evaluateProductionSigningSalt(): string | null {
  if (process.env.NODE_ENV !== 'production') return null
  const s = process.env.API_SIGNING_SALT?.trim()
  if (!s) {
    return 'FATAL_SECURITY_MISCONFIGURATION: Production requires API_SIGNING_SALT.'
  }
  if (s === SCAN_API_DOCS_DEV_SIGNING_SALT) {
    return 'FATAL_SECURITY_MISCONFIGURATION: Production environment detected invalid signing salt.'
  }
  return null
}

/** Call from `instrumentation.ts` (server bootstrap). Fails hard in production when misconfigured. */
export function assertSentinelSigningOnStartup(): void {
  const fatal = evaluateProductionSigningSalt()
  if (fatal) {
    throw new FatalSentinelSigningMisconfiguration(fatal)
  }
}

/**
 * Secondary safeguard before cryptographic operations or signed routes.
 * Surfaces misconfiguration as a safe API 500 (does not exit the process).
 */
export function assertSentinelSigningEnvironment(): void {
  const fatal = evaluateProductionSigningSalt()
  if (fatal) {
    throw new SentinelServerMisconfigurationError()
  }
}

export function getSigningSaltOrThrow(): string {
  assertSentinelSigningEnvironment()
  if (process.env.NODE_ENV === 'production') {
    return process.env.API_SIGNING_SALT!.trim()
  }
  // Local dev: explicit salt, or documented dev fallback (matches SDK default).
  return process.env.API_SIGNING_SALT?.trim() || SCAN_API_DOCS_DEV_SIGNING_SALT
}
