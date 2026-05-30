import { PublicKey } from '@solana/web3.js'
import { getMint } from '@solana/spl-token'
import { getPrimaryConnection } from '@/lib/services/scanner/RpcProviderManager'
import { Redis } from '@upstash/redis'

const ENRICH_PREFIX = 'cc:sentinel:enrich:v1:'
const ENRICH_TTL_SEC = 60

/** Order-of-magnitude reference liquidity (USD) for curated majors — **model inputs**, not scores. */
const VERIFIED_DEEP_LIQUIDITY: Record<
  string,
  { liquidityUsd: number; pairAgeMinutes: number; confidenceHint: number; label: string; regulatedIssuer: boolean }
> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    liquidityUsd: 3_000_000_000,
    pairAgeMinutes: 1_000_000,
    confidenceHint: 99,
    label: 'USDC',
    regulatedIssuer: true,
  },
  JUPyiwrYJFv1mHSSge9dB8EjzzxZrMciSJAThvB6mZe: {
    liquidityUsd: 250_000_000,
    pairAgeMinutes: 400_000,
    confidenceHint: 97,
    label: 'JUP',
    regulatedIssuer: true,
  },
  So11111111111111111111111111111111111111112: {
    liquidityUsd: 4_000_000_000,
    pairAgeMinutes: 2_000_000,
    confidenceHint: 98,
    label: 'SOL (wrapped)',
    regulatedIssuer: true,
  },
}

function redis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return Redis.fromEnv()
}

export type ChainEnrichmentFields = {
  liquidityUsd?: number | null
  topHolderPct?: number | null
  pairAgeMinutes?: number | null
  mintAuthorityActive?: boolean | null
  freezeAuthorityActive?: boolean | null
  regulatedIssuer?: boolean | null
  /** 0–100 confidence hint from data completeness (fed into engine). */
  enrichmentConfidenceHint?: number | null
  enrichmentLabel?: string | null
}

async function rpcPost<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'cc-sentinel', method, params }),
  })
  const j = (await res.json()) as { error?: { message: string }; result: T }
  if (j.error) throw new Error(j.error.message)
  return j.result
}

type LargestAccountRow = {
  address: string
  amount: string
  decimals: number
  uiAmount: number
}

async function fetchLargestAccountRows(
  endpoint: string,
  mintPk: PublicKey
): Promise<LargestAccountRow[] | null> {
  try {
    const result = await rpcPost<{ value: LargestAccountRow[] }>(endpoint, 'getTokenLargestAccounts', [
      mintPk.toBase58(),
      { commitment: 'processed' },
    ])
    const rows = result?.value
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rows
  } catch {
    return null
  }
}

function topHolderConcentrationFromRows(rows: LargestAccountRow[], supplyUi: number): number | null {
  if (!Number.isFinite(supplyUi) || supplyUi <= 0) return null
  const row = rows[0] as { uiAmount?: number; uiAmountString?: string }
  const top =
    typeof row.uiAmount === 'number' && Number.isFinite(row.uiAmount)
      ? row.uiAmount
      : parseFloat(String(row.uiAmountString ?? '0'))
  if (!Number.isFinite(top) || top <= 0) return null
  return Math.min(100, Math.max(0, (top / supplyUi) * 100))
}

/**
 * Fetches on-chain token program fields + optional verified liquidity references.
 * Results are cached in Redis (60s) by mint.
 */
export async function enrichScanBodyFromChain(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const mint = String(body.mint ?? body.tokenAddress ?? '').trim()
  if (mint.length < 32) return body

  const r = redis()
  const cacheKey = `${ENRICH_PREFIX}${mint}`
  if (r) {
    try {
      const raw = await r.get<string>(cacheKey)
      if (raw) {
        const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as ChainEnrichmentFields
        return { ...body, ...parsed, _enrichmentCached: true }
      }
    } catch {
      /* miss */
    }
  }

  let merged: ChainEnrichmentFields = {}

  const verified = VERIFIED_DEEP_LIQUIDITY[mint]
  if (verified) {
    merged = {
      liquidityUsd: verified.liquidityUsd,
      pairAgeMinutes: verified.pairAgeMinutes,
      enrichmentConfidenceHint: verified.confidenceHint,
      enrichmentLabel: verified.label,
      regulatedIssuer: verified.regulatedIssuer,
    }
  }

  // On-chain enrichment is best-effort: a missing HELIUS_API_KEY (getPrimaryConnection throws)
  // or an RPC failure must NOT 500 the scan. Degrade to a low-confidence result instead.
  let enrichmentFailed = false
  let enrichmentError: string | undefined

  try {
    const { connection } = getPrimaryConnection()
    const mintPk = new PublicKey(mint)
    const [m, largestRows] = await Promise.all([
      getMint(connection, mintPk),
      fetchLargestAccountRows(connection.rpcEndpoint, mintPk),
    ])
    const mintActive = m.mintAuthority != null
    const freezeActive = m.freezeAuthority != null
    const supplyUi = Number(m.supply) / 10 ** m.decimals

    merged.mintAuthorityActive = mintActive
    merged.freezeAuthorityActive = freezeActive

    if (merged.topHolderPct == null && largestRows?.length) {
      const topPct = topHolderConcentrationFromRows(largestRows, supplyUi)
      if (topPct != null) merged.topHolderPct = Math.round(topPct * 10) / 10
    }

    if (merged.enrichmentConfidenceHint == null) merged.enrichmentConfidenceHint = 72
  } catch (e) {
    enrichmentFailed = true
    enrichmentError = e instanceof Error ? e.message : String(e)
    console.error('[enrichScanBodyFromChain] enrichment failed; continuing with degraded data', {
      mint,
      error: enrichmentError,
    })
    // Low confidence when chain data is unavailable; verified majors retain a modest floor.
    if (merged.enrichmentConfidenceHint == null) merged.enrichmentConfidenceHint = verified ? 88 : 30
  }

  if (!verified) {
    merged.regulatedIssuer = false
    if (merged.enrichmentConfidenceHint == null || merged.enrichmentConfidenceHint > 72)
      merged.enrichmentConfidenceHint = enrichmentFailed ? 30 : 60
  }

  const out: Record<string, unknown> = { ...body, ...merged }
  if (enrichmentFailed) {
    out._enrichment_failed = true
    out._enrichment_error = enrichmentError
  }

  // Only cache successful enrichment — never persist a degraded/failed snapshot.
  if (r && !enrichmentFailed) {
    try {
      await r.set(cacheKey, JSON.stringify(merged), { ex: ENRICH_TTL_SEC })
    } catch {
      /* best-effort */
    }
  }

  return out
}
