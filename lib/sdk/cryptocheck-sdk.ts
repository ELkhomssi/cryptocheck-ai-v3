/**
 * CryptoCheck AI — TypeScript SDK (Node.js 18+)
 *
 * HMAC-SHA256 request signing matches `@/lib/security/signing/hmac` and API docs:
 * - Derived key: SHA256(utf8(apiKey + signingSalt))
 * - Message: `${unixTimestampSeconds}\n${exactRawRequestBody}`
 * - Signature: HMAC-SHA256(derivedKey, message) as hex (or base64 via signEncoding)
 *
 * Signing is optional at the API layer; enable with `signRequests: true` (default).
 */

import { createHash, createHmac } from 'node:crypto'
import { SCAN_API_DOCS_DEV_SIGNING_SALT } from '@/lib/security/signing/env'

export type CryptoCheckClientOptions = {
  apiKey: string
  /** e.g. https://www.cryptocheckai.com — defaults from CRYPTOCHECK_BASE_URL / NEXT_PUBLIC_SITE_URL */
  baseUrl?: string
  /**
   * Must match the server `API_SIGNING_SALT` when verifying signatures.
   * Resolution: `signingSalt` option → CRYPTOCHECK_SIGNING_SALT → API_SIGNING_SALT → dev fallback.
   */
  signingSalt?: string
  /** When true (default), sends X-CryptoCheck-Timestamp + X-CryptoCheck-Signature for mutating requests. */
  signRequests?: boolean
  /** Hex (default) or base64 for X-CryptoCheck-Signature */
  signEncoding?: 'hex' | 'base64'
  fetch?: typeof fetch
}

export class CryptoCheckError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message)
    this.name = 'CryptoCheckError'
  }
}

function resolveSigningSalt(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim()
  const a = process.env.CRYPTOCHECK_SIGNING_SALT?.trim()
  if (a) return a
  const b = process.env.API_SIGNING_SALT?.trim()
  if (b) return b
  return SCAN_API_DOCS_DEV_SIGNING_SALT
}

export function resolveCryptocheckBaseUrl(): string {
  const u =
    process.env.CRYPTOCHECK_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (u) return u.replace(/\/$/, '')
  return 'https://www.cryptocheckai.com'
}

function deriveSigningKeyMaterial(apiKey: string, signingSalt: string): Buffer {
  return createHash('sha256').update(apiKey + signingSalt, 'utf8').digest()
}

function buildSignature(
  unixSeconds: string,
  rawBody: string,
  apiKey: string,
  signingSalt: string,
  encoding: 'hex' | 'base64'
): string {
  const key = deriveSigningKeyMaterial(apiKey, signingSalt)
  const message = `${unixSeconds}\n${rawBody}`
  const mac = createHmac('sha256', key).update(message, 'utf8').digest()
  return encoding === 'hex' ? mac.toString('hex') : mac.toString('base64')
}

export class CryptoCheckClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly signingSalt: string
  private readonly signRequests: boolean
  private readonly signEncoding: 'hex' | 'base64'
  private readonly fetchImpl: typeof fetch

  constructor(options: CryptoCheckClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error('CryptoCheckClient: apiKey is required')
    }
    this.apiKey = options.apiKey.trim()
    this.baseUrl = (options.baseUrl ?? resolveCryptocheckBaseUrl()).replace(/\/$/, '')
    this.signingSalt = resolveSigningSalt(options.signingSalt)
    this.signRequests = options.signRequests !== false
    this.signEncoding = options.signEncoding ?? 'hex'
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  /**
   * POST /api/v1/scan — institutional token risk analysis.
   */
  async scanToken(
    tokenAddress: string,
    scanOpts?: {
      chain?: 'solana' | 'sol'
      /** Prefer compact platform JSON */
      responseMode?: 'platform' | 'full'
      liquidityUsd?: number
      topHolderPct?: number
    }
  ): Promise<unknown> {
    const body: Record<string, unknown> = {
      tokenAddress: tokenAddress.trim(),
      chain: scanOpts?.chain ?? 'solana',
    }
    if (scanOpts?.responseMode === 'platform') body.responseMode = 'platform'
    if (typeof scanOpts?.liquidityUsd === 'number') body.liquidityUsd = scanOpts.liquidityUsd
    if (typeof scanOpts?.topHolderPct === 'number') body.topHolderPct = scanOpts.topHolderPct

    const rawBody = JSON.stringify(body)
    return this.postJson('/api/v1/scan', rawBody, {
      accept:
        scanOpts?.responseMode === 'platform' ? 'application/vnd.cryptocheck.platform+json' : 'application/json',
    })
  }

  /**
   * Low-level signed POST with a pre-serialized JSON body (wire-exact for HMAC).
   */
  async postJson(
    path: string,
    rawBody: string,
    init?: { accept?: string }
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const ts = String(Math.floor(Date.now() / 1000))

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: init?.accept ?? 'application/json',
      'X-CryptoCheck-Timestamp': ts,
      'User-Agent': `cryptocheck-sdk-ts/${SDK_VERSION}`,
    }

    if (this.signRequests) {
      headers['X-CryptoCheck-Signature'] = buildSignature(
        ts,
        rawBody,
        this.apiKey,
        this.signingSalt,
        this.signEncoding
      )
    }

    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: rawBody,
    })

    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }

    if (!res.ok) {
      const msg =
        typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof (parsed as { error: unknown }).error === 'string'
          ? (parsed as { error: string }).error
          : `HTTP ${res.status}`
      throw new CryptoCheckError(msg, res.status, parsed)
    }

    return parsed
  }
}

export const SDK_VERSION = '1.0.0'

export { SCAN_API_DOCS_DEV_SIGNING_SALT as DEV_SIGNING_SALT_FALLBACK }
