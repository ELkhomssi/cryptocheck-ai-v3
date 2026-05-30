import {
  buildRequestSignature,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  type SignEncoding,
} from '@cryptocheck/signing'
import { CCAIConnectError, errorMessageFromBody } from './errors.js'
import { resolveConnectBaseUrl, resolveSigningSalt } from './resolve.js'
import type {
  AssessRiskParams,
  BatchScanItem,
  ConnectChainId,
  InstitutionalScanResult,
  PlatformScanResult,
  ReputationParams,
  ReputationSnapshot,
} from './types.js'

export const CONNECT_SDK_VERSION = '1.0.0'

export type CCAIConnectClientOptions = {
  apiKey: string
  baseUrl?: string
  signingSalt?: string
  /** When true (default), sends HMAC headers on mutating requests. */
  signRequests?: boolean
  signEncoding?: SignEncoding
  fetch?: typeof fetch
  /** Optional partner id for B2B routes (future). */
  partnerId?: string
}

export class CCAIConnectClient {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly signingSalt: string
  private readonly signRequests: boolean
  private readonly signEncoding: SignEncoding
  private readonly fetchImpl: typeof fetch
  private readonly partnerId?: string

  constructor(options: CCAIConnectClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error('CCAIConnectClient: apiKey is required')
    }
    this.apiKey = options.apiKey.trim()
    this.baseUrl = resolveConnectBaseUrl(options.baseUrl)
    this.signingSalt = resolveSigningSalt(options.signingSalt)
    this.signRequests = options.signRequests !== false
    this.signEncoding = options.signEncoding ?? 'hex'
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.partnerId = options.partnerId?.trim() || undefined
  }

  /**
   * POST /api/v1/scan — primary risk assessment for wallets and DEX integrations.
   */
  async assessRisk(params: AssessRiskParams): Promise<InstitutionalScanResult | PlatformScanResult> {
    const body: Record<string, unknown> = {
      tokenAddress: params.address.trim(),
      mint: params.address.trim(),
      chain: params.chain ?? 'solana',
    }
    if (params.depth === 'fast') body.depth = 'fast'
    if (params.responseMode === 'platform') body.responseMode = 'platform'
    if (typeof params.liquidityUsd === 'number') body.liquidityUsd = params.liquidityUsd
    if (typeof params.topHolderPct === 'number') body.topHolderPct = params.topHolderPct

    const rawBody = JSON.stringify(body)
    const accept =
      params.responseMode === 'platform' ? 'application/vnd.cryptocheck.platform+json' : 'application/json'

    return this.postJson('/api/v1/scan', rawBody, { accept }) as Promise<
      InstitutionalScanResult | PlatformScanResult
    >
  }

  /** Alias for `assessRisk` — matches legacy CryptoCheckClient naming. */
  async scanToken(
    tokenAddress: string,
    opts?: Omit<AssessRiskParams, 'address'>
  ): Promise<InstitutionalScanResult | PlatformScanResult> {
    return this.assessRisk({ ...opts, address: tokenAddress })
  }

  /**
   * GET /api/v1/scan?depth=fast&mint= — server-side style fast path (requires CRON_SECRET on server;
   * integrators should prefer `assessRisk({ depth: 'fast' })` with API key).
   */
  async assessRiskFastQuery(mint: string, chain: ConnectChainId = 'solana'): Promise<InstitutionalScanResult> {
    const q = new URLSearchParams({ depth: 'fast', mint: mint.trim(), chain })
    return this.getJson(`/api/v1/scan?${q.toString()}`) as Promise<InstitutionalScanResult>
  }

  /** POST /api/v1/scan/batch — platform JSON per item. */
  async batchScan(items: BatchScanItem[], opts?: { clientRef?: string }): Promise<unknown> {
    const body: Record<string, unknown> = {
      items: items.map((i) => ({
        tokenAddress: i.tokenAddress.trim(),
        chain: i.chain ?? 'solana',
      })),
    }
    if (opts?.clientRef) body.clientRef = opts.clientRef.slice(0, 80)
    return this.postJson('/api/v1/scan/batch', JSON.stringify(body))
  }

  /**
   * GET /api/b2b/v1/reputation — when B2B route is deployed; returns structured reputation snapshot.
   */
  async getReputation(params: ReputationParams): Promise<ReputationSnapshot> {
    const q = new URLSearchParams({
      chain: params.chain,
      address: params.address.trim(),
    })
    return this.getJson(`/api/b2b/v1/reputation?${q.toString()}`) as Promise<ReputationSnapshot>
  }

  /** POST /api/b2b/v1/risk — partner fast/full risk (when route deployed). */
  async assessRiskB2B(params: AssessRiskParams & { webhookUrl?: string }): Promise<unknown> {
    const body: Record<string, unknown> = {
      chain: params.chain ?? 'solana',
      address: params.address.trim(),
      mode: params.depth ?? 'fast',
    }
    if (params.webhookUrl) body.webhookUrl = params.webhookUrl
    return this.postJson('/api/b2b/v1/risk', JSON.stringify(body))
  }

  /** GET /api/v1/ping — connectivity check. */
  async ping(): Promise<unknown> {
    return this.getJson('/api/v1/ping')
  }

  async postJson(path: string, rawBody: string, init?: { accept?: string }): Promise<unknown> {
    const url = this.url(path)
    const headers = this.baseHeaders(init?.accept)
    if (this.signRequests) {
      const ts = headers[TIMESTAMP_HEADER]
      headers[SIGNATURE_HEADER] = buildRequestSignature(
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
    return this.parseResponse(res)
  }

  async getJson(path: string, init?: { accept?: string }): Promise<unknown> {
    const headers = this.baseHeaders(init?.accept)
    if (this.signRequests) {
      const ts = headers[TIMESTAMP_HEADER]
      headers[SIGNATURE_HEADER] = buildRequestSignature(
        ts,
        '',
        this.apiKey,
        this.signingSalt,
        this.signEncoding
      )
    }
    const res = await this.fetchImpl(this.url(path), {
      method: 'GET',
      headers,
    })
    return this.parseResponse(res)
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
  }

  private baseHeaders(accept = 'application/json'): Record<string, string> {
    const ts = String(Math.floor(Date.now() / 1000))
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: accept,
      'Content-Type': 'application/json',
      [TIMESTAMP_HEADER]: ts,
      'User-Agent': `ccai-connect/${CONNECT_SDK_VERSION}`,
    }
    if (this.partnerId) {
      headers['X-CCAI-Partner-Id'] = this.partnerId
    }
    return headers
  }

  private async parseResponse(res: Response): Promise<unknown> {
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    if (!res.ok) {
      throw new CCAIConnectError(errorMessageFromBody(parsed, res.status), res.status, parsed)
    }
    return parsed
  }
}

/** @deprecated Use CCAIConnectClient — alias for migration from CryptoCheckClient. */
export const CryptoCheckClient = CCAIConnectClient
