import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Derived_Secret = SHA256(UTF-8(api_key + signing_salt)); HMAC key material (never the raw API key).
 */
export function deriveApiHmacSigningKey(rawApiKey: string, signingSalt: string): Buffer {
  return createHash('sha256').update(rawApiKey + signingSalt, 'utf8').digest()
}

/** Wire-exact UTF-8 body octets for the signed message. */
export function normalizeRequestPayload(rawBody: string): string {
  return rawBody
}

function parseSignatureBytes(signatureHeader: string): Buffer | null {
  try {
    const hex = signatureHeader.toLowerCase().trim()
    if (/^[0-9a-f]+$/.test(hex) && hex.length % 2 === 0) {
      return Buffer.from(hex, 'hex')
    }
    return Buffer.from(signatureHeader.trim(), 'base64')
  } catch {
    return null
  }
}

export type SignEncoding = 'hex' | 'base64'

/**
 * Build `X-CryptoCheck-Signature` for outbound requests.
 * Message: `${unixTimestampSeconds}\n${exactRawRequestBody}`
 */
export function buildRequestSignature(
  unixSeconds: string,
  rawBody: string,
  rawApiKey: string,
  signingSalt: string,
  encoding: SignEncoding = 'hex'
): string {
  const derived = deriveApiHmacSigningKey(rawApiKey, signingSalt)
  const message = `${unixSeconds}\n${normalizeRequestPayload(rawBody)}`
  const mac = createHmac('sha256', derived).update(message, 'utf8').digest()
  return encoding === 'hex' ? mac.toString('hex') : mac.toString('base64')
}

/**
 * Verify inbound signature (hex or base64). Constant-time compare when lengths match.
 */
export function verifySignature(
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
  rawApiKey: string,
  signingSalt: string
): boolean {
  const derived = deriveApiHmacSigningKey(rawApiKey, signingSalt)
  const payload = `${timestamp}\n${normalizeRequestPayload(rawBody)}`
  const expected = createHmac('sha256', derived).update(payload, 'utf8').digest()
  const provided = parseSignatureBytes(signatureHeader)
  if (!provided || provided.length !== expected.length) {
    return false
  }
  return timingSafeEqual(provided, expected)
}
