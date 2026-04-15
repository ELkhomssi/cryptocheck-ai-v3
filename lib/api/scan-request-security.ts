import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { extractRawApiKey } from '@/lib/middleware/with-api-auth'
import type { ScanAccessContext } from '@/lib/auth/scan-access'
import { ScanServiceError } from '@/lib/services/scanner/ErrorHandler'
import { scanClientIp } from '@/lib/auth/scan-access'

const TIMESTAMP_HEADER = 'x-cryptocheck-timestamp'
const SIGNATURE_HEADER = 'x-cryptocheck-signature'

/**
 * Dev-only fallback when `API_SIGNING_SALT` is unset (never use in production without setting the env).
 * Exported so `/api/docs` can reference the same string for local integration tests.
 */
export const SCAN_API_DOCS_DEV_SIGNING_SALT = 'cryptocheck_dev_api_signing_salt_v1'

/**
 * Same salt string the client must use with their API key to derive the HMAC key (see /api/docs).
 * Raw API keys are never used as the HMAC key material; only this SHA-256 digest is.
 */
function apiSigningSalt(): string {
  const s = process.env.API_SIGNING_SALT?.trim()
  if (s) return s
  if (process.env.NODE_ENV === 'production') {
    throw new ScanServiceError(
      'Request signing is not configured on the server (missing API_SIGNING_SALT).',
      'SIGNING_MISCONFIGURED',
      500,
      undefined,
      'SIGNING_MISCONFIGURED',
      'high'
    )
  }
  return SCAN_API_DOCS_DEV_SIGNING_SALT
}

/**
 * Derived_Secret = SHA256(Raw_API_Key + Server_Salt) — UTF-8 string concat, then SHA-256.
 * Used as the HMAC key (not the raw API key string).
 */
export function deriveApiHmacSigningKey(rawApiKey: string): Buffer {
  const salt = apiSigningSalt()
  return createHash('sha256').update(rawApiKey + salt, 'utf8').digest()
}
/** API key requests must include a Unix timestamp (seconds); max skew vs server time. */
const MAX_CLOCK_SKEW_SEC = 300

function parseEnterpriseIpAllowlist(): string[] {
  const raw = process.env.CRYPTOCHECK_ENTERPRISE_IP_ALLOWLIST?.trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function ipAllowed(clientIp: string | null, allowed: string[]): boolean {
  if (allowed.length === 0) return true
  if (!clientIp) return false
  return allowed.includes(clientIp)
}

/**
 * API-key requests must send `X-CryptoCheck-Timestamp` (Unix seconds) within ±5 minutes of server time.
 * Browser session calls skip (same-site dashboard).
 */
export function assertScanTimestamp(req: NextRequest, ctx: ScanAccessContext): void {
  if (ctx.via !== 'api_key') return
  const raw = req.headers.get(TIMESTAMP_HEADER)?.trim()
  if (!raw) {
    throw new ScanServiceError(
      'Missing X-CryptoCheck-Timestamp (Unix seconds). Required for API key requests.',
      'MISSING_TIMESTAMP',
      400,
      undefined,
      'MISSING_TIMESTAMP',
      'medium'
    )
  }
  const ts = Number(raw)
  if (!Number.isFinite(ts) || ts < 1_000_000_000) {
    throw new ScanServiceError(
      'Invalid X-CryptoCheck-Timestamp. Use Unix time in seconds.',
      'INVALID_TIMESTAMP',
      400,
      undefined,
      'INVALID_TIMESTAMP',
      'medium'
    )
  }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > MAX_CLOCK_SKEW_SEC) {
    throw new ScanServiceError(
      'Request timestamp expired or not yet valid. Resync within ±5 minutes.',
      'REQUEST_EXPIRED',
      400,
      undefined,
      'REQUEST_EXPIRED',
      'high'
    )
  }
}

/**
 * Optional HMAC-SHA256 integrity check (Enterprise / institutional API keys).
 * When present, must match:
 *   HMAC_SHA256( Derived_Secret, `${timestamp}\n${rawBody}` )
 * where Derived_Secret = SHA256(Raw_API_Key + Server_Salt); see `deriveApiHmacSigningKey`.
 */
export function assertScanSignature(req: NextRequest, rawBody: string, ctx: ScanAccessContext): void {
  const sigHeader = req.headers.get(SIGNATURE_HEADER)?.trim()
  if (!sigHeader) return

  if (ctx.via !== 'api_key') {
    throw new ScanServiceError(
      'X-CryptoCheck-Signature requires an API key (Bearer) context.',
      'SIGNATURE_REQUIRES_API_KEY',
      401,
      undefined,
      'SIGNATURE_REQUIRES_API_KEY',
      'high'
    )
  }

  const rawKey = extractRawApiKey(req)
  if (!rawKey) {
    throw new ScanServiceError(
      'Could not read API key for signature verification.',
      'INVALID_SIGNATURE',
      401,
      undefined,
      'INVALID_SIGNATURE',
      'high'
    )
  }

  let derivedKey: Buffer
  try {
    derivedKey = deriveApiHmacSigningKey(rawKey)
  } catch (e) {
    if (e instanceof ScanServiceError) throw e
    throw new ScanServiceError(
      'Request signing configuration error.',
      'SIGNING_MISCONFIGURED',
      500,
      e,
      'SIGNING_MISCONFIGURED',
      'high'
    )
  }

  const ts = req.headers.get(TIMESTAMP_HEADER)?.trim() ?? ''
  const payload = `${ts}\n${rawBody}`
  const expected = createHmac('sha256', derivedKey).update(payload, 'utf8').digest()

  let provided: Buffer
  try {
    const hex = sigHeader.toLowerCase()
    if (/^[0-9a-f]+$/.test(hex) && hex.length % 2 === 0) {
      provided = Buffer.from(hex, 'hex')
    } else {
      provided = Buffer.from(sigHeader, 'base64')
    }
  } catch {
    throw new ScanServiceError(
      'Invalid X-CryptoCheck-Signature encoding (use hex or base64).',
      'INVALID_SIGNATURE',
      400,
      undefined,
      'INVALID_SIGNATURE',
      'medium'
    )
  }

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new ScanServiceError(
      'X-CryptoCheck-Signature verification failed.',
      'INVALID_SIGNATURE',
      401,
      undefined,
      'INVALID_SIGNATURE',
      'high'
    )
  }
}

/** `institutional` tier (product: Enterprise) — optional IP allowlist via env. */
export function assertEnterpriseIpAllowlist(req: NextRequest, ctx: ScanAccessContext): void {
  if (ctx.tier !== 'institutional') return
  const allowed = parseEnterpriseIpAllowlist()
  if (allowed.length === 0) return

  const ip = scanClientIp(req)
  if (!ipAllowed(ip, allowed)) {
    throw new ScanServiceError(
      'Client IP is not on the Enterprise allowlist.',
      'IP_NOT_ALLOWED',
      403,
      undefined,
      'IP_NOT_ALLOWED',
      'high'
    )
  }
}
