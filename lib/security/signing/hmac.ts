/**
 * Server adapter — delegates crypto to `@cryptocheck/signing`; salt from env guards.
 */

import {
  deriveApiHmacSigningKey as deriveKey,
  normalizeRequestPayload,
  verifySignature as verifyWithSalt,
} from '@cryptocheck/signing'
import { getSigningSaltOrThrow } from '@/lib/security/signing/env'

export { normalizeRequestPayload }

export function deriveApiHmacSigningKey(rawApiKey: string): Buffer {
  return deriveKey(rawApiKey, getSigningSaltOrThrow())
}

export function verifySignature(
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
  rawApiKey: string
): boolean {
  return verifyWithSalt(timestamp, rawBody, signatureHeader, rawApiKey, getSigningSaltOrThrow())
}
