import { createHash, randomBytes } from 'crypto'

/** SHA-256 hex digest for API key storage (never store raw keys). */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** URL-safe random token for key material. */
export function randomTokenUrlSafe(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url')
}
