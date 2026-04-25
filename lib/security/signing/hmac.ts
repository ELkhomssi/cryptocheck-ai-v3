/**
 * SENTINEL signing — HMAC-SHA256 and SHA-256 key derivation (Node crypto only).
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { getSigningSaltOrThrow } from '@/lib/security/signing/env'

/**
 * Derived_Secret = SHA256(UTF-8(api_key + signing_salt)); used as HMAC key material (never the raw API key).
 */
export function deriveApiHmacSigningKey(rawApiKey: string): Buffer {
  const salt = getSigningSaltOrThrow()
  return createHash('sha256').update(rawApiKey + salt, 'utf8').digest()
}

/**
 * Canonical body octets for the signed message. Wire-exact UTF-8 string from the HTTP body.
 */
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

/**
 * Constant-time–friendly verification: `signature` is hex or base64 of HMAC-SHA256 output.
 * `key` is the raw API key (deriveApiHmacSigningKey is applied internally).
 */
export function verifySignature(
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
  rawApiKey: string
): boolean {
  const derived = deriveApiHmacSigningKey(rawApiKey)
  const payload = `${timestamp}\n${normalizeRequestPayload(rawBody)}`
  const expected = createHmac('sha256', derived).update(payload, 'utf8').digest()
  const provided = parseSignatureBytes(signatureHeader)
  if (!provided || provided.length !== expected.length) {
    return false
  }
  return timingSafeEqual(provided, expected)
}
