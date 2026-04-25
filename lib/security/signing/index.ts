/**
 * SENTINEL Core — barrel export. Cryptographic primitives live in `hmac.ts`; env guards in `env.ts`.
 */
export {
  SCAN_API_SECURITY_DOCS_URL,
  SCAN_API_DOCS_DEV_SIGNING_SALT,
  FatalSentinelSigningMisconfiguration,
  SentinelServerMisconfigurationError,
  assertSentinelSigningOnStartup,
  assertSentinelSigningEnvironment,
  getSigningSaltOrThrow,
} from '@/lib/security/signing/env'

export { deriveApiHmacSigningKey, normalizeRequestPayload, verifySignature } from '@/lib/security/signing/hmac'
