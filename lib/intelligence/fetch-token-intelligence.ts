import 'server-only'

import { heliusRest, rpcCall } from '@/lib/helius-server'
import type { TokenMeta } from '@/lib/helius'
import type {
  AuthorityField,
  KeyTier,
  LiquidityLockInfo,
  PublicSubscriptionTier,
  TokenIntelligenceReport,
  TopHolderRow,
} from '@/lib/types/intelligence'
import { computeRiskScoreAndSignals } from '@/lib/intelligence/risk-score'

type DexPair = {
  baseToken?: { symbol?: string; name?: string }
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  pairCreatedAt?: number
  fdv?: number
  marketCap?: number
}

type DexTokenResponse = {
  pairs?: DexPair[] | null
}

function normalizeAuthField(addr: string | null): AuthorityField {
  return {
    address: addr,
    renounced: addr === null,
  }
}

function normalizeMintAuth(a: unknown): string | null {
  if (a === null || a === undefined) return null
  if (typeof a === 'string') return a
  if (typeof a === 'object' && a && 'address' in a && typeof (a as { address?: string }).address === 'string') {
    return (a as { address: string }).address
  }
  return null
}

async function fetchDexBestPair(mint: string): Promise<DexPair | null> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    next: { revalidate: 0 },
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`DexScreener HTTP ${res.status}`)
  }
  const j = (await res.json()) as DexTokenResponse
  const pairs = j.pairs
  if (!pairs?.length) return null
  return pairs[0]
}

async function fetchMintParsed(mint: string): Promise<{
  decimals: number
  mintAuthority: string | null
  freezeAuthority: string | null
} | null> {
  const res = await rpcCall<{
    value: {
      data: {
        parsed?: {
          type?: string
          info?: {
            mintAuthority?: unknown
            freezeAuthority?: unknown
            decimals?: number
          }
        }
      }
    } | null
  }>('getAccountInfo', [mint, { encoding: 'jsonParsed' }])
  const parsed = res?.value?.data?.parsed
  if (!parsed?.info) return null
  const info = parsed.info
  return {
    decimals: typeof info.decimals === 'number' ? info.decimals : 9,
    mintAuthority: normalizeMintAuth(info.mintAuthority),
    freezeAuthority: normalizeMintAuth(info.freezeAuthority),
  }
}

async function fetchSupply(mint: string): Promise<{ raw: string; ui: number | null }> {
  const res = await rpcCall<{
    value: { amount: string; decimals: number; uiAmount: number | null }
  }>('getTokenSupply', [mint])
  const v = res?.value
  if (!v) return { raw: '0', ui: null }
  return { raw: v.amount, ui: v.uiAmount }
}

async function fetchLargestHolders(mint: string): Promise<
  Array<{ address: string; amount: string; uiAmount: number | null }>
> {
  const res = await rpcCall<{
    value: Array<{ address: string; amount: string; uiAmount: number | null }>
  }>('getTokenLargestAccounts', [mint])
  return res?.value ?? []
}

async function fetchMetadata(mint: string): Promise<TokenMeta | null> {
  const arr = await heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: [mint] })
  return arr?.[0] ?? null
}

async function fetchRecentTxCount(mint: string): Promise<number> {
  try {
    const txs = await heliusRest<unknown[]>(`/addresses/${mint}/transactions`)
    return Array.isArray(txs) ? txs.length : 0
  } catch {
    return 0
  }
}

function parseImageUrl(meta: TokenMeta | null): string | null {
  const uri = meta?.onChainMetadata?.metadata?.data?.uri
  if (typeof uri === 'string' && uri.startsWith('http')) return uri
  return null
}

function parseUpdateAuthority(meta: TokenMeta | null): AuthorityField | null {
  const raw = meta?.onChainMetadata?.metadata?.updateAuthority
  if (raw === undefined) return null
  const addr = typeof raw === 'string' ? raw : null
  return normalizeAuthField(addr)
}

function buildTopHolders(
  rows: Array<{ address: string; amount: string; uiAmount: number | null }>,
  supplyRaw: string,
  decimals: number
): { holders: TopHolderRow[]; top10Concentration: number } {
  let total = 0n
  try {
    total = BigInt(supplyRaw || '0')
  } catch {
    total = 0n
  }
  if (total <= 0n) return { holders: [], top10Concentration: 0 }

  const sorted = [...rows].slice(0, 20)
  const holders: TopHolderRow[] = sorted.map((r) => {
    let amt = 0n
    try {
      amt = BigInt(r.amount || '0')
    } catch {
      amt = 0n
    }
    const pct = Number((amt * 10000n) / total) / 100
    return {
      address: r.address,
      pct,
      isContract: false,
      isLp: false,
    }
  })

  const top10 = holders.slice(0, 10)
  const sum10 = top10.reduce((a, h) => a + h.pct, 0)
  return { holders, top10Concentration: Math.min(100, sum10) }
}

function bestEffortLiquidityLock(_pair: DexPair | null): LiquidityLockInfo {
  return {
    status: 'unknown',
    burnedPct: null,
    lockUntil: null,
  }
}

export type BuildReportArgs = {
  mint: string
  keyTier: KeyTier
  publicTier: PublicSubscriptionTier
  scanId: string
  onlyTicker: boolean
}

/** Thrown when DexScreener has no pair and Helius has no metadata (successful empty responses only). */
export class TokenNotFoundError extends Error {
  readonly code = 'TOKEN_NOT_FOUND' as const
  constructor(readonly mint: string) {
    super(`No upstream token data for mint ${mint}`)
    this.name = 'TokenNotFoundError'
  }
}

export async function buildTokenIntelligenceReport(args: BuildReportArgs): Promise<TokenIntelligenceReport> {
  const { mint, keyTier, publicTier, scanId, onlyTicker } = args
  const scannedAt = new Date().toISOString()

  if (onlyTicker) {
    const dexPair = await fetchDexBestPair(mint)
    if (!dexPair) {
      throw new TokenNotFoundError(mint)
    }
    const price = dexPair?.priceUsd != null ? parseFloat(dexPair.priceUsd) : null
    const liquidityUsd = dexPair?.liquidity?.usd ?? null
    const volume24h = dexPair?.volume?.h24 ?? null
    const priceChange24h = dexPair?.priceChange?.h24 ?? null
    const pairCreatedAt = dexPair?.pairCreatedAt
    const pairAgeDays =
      pairCreatedAt != null ? (Date.now() - pairCreatedAt) / (86_400_000) : null
    let marketCap: number | null = null
    if (dexPair?.marketCap != null && typeof dexPair.marketCap === 'number') {
      marketCap = dexPair.marketCap
    } else if (dexPair?.fdv != null && typeof dexPair.fdv === 'number') {
      marketCap = dexPair.fdv
    }
    const sym = dexPair?.baseToken?.symbol ?? '???'
    const nm = dexPair?.baseToken?.name ?? sym
    const baseMeta = {
      scannedAt,
      cacheAge: 0,
      scanId,
      keyTier,
      subscriptionTier: publicTier,
    }
    return {
      mint,
      name: nm,
      symbol: sym,
      imageUrl: null,
      decimals: 9,
      supply: { raw: '0', ui: null },
      price,
      priceChange24h,
      marketCap,
      volume24h,
      liquidityUsd,
      pairAgeDays,
      recentTxCount: null,
      meta: baseMeta,
    }
  }

  const [dexPair, meta] = await Promise.all([fetchDexBestPair(mint), fetchMetadata(mint)])
  if (dexPair === null && meta === null) {
    throw new TokenNotFoundError(mint)
  }

  const [supply, txCount] = await Promise.all([fetchSupply(mint), fetchRecentTxCount(mint)])

  const price = dexPair?.priceUsd != null ? parseFloat(dexPair.priceUsd) : null
  const liquidityUsd = dexPair?.liquidity?.usd ?? null
  const volume24h = dexPair?.volume?.h24 ?? null
  const priceChange24h = dexPair?.priceChange?.h24 ?? null
  const pairCreatedAt = dexPair?.pairCreatedAt
  const pairAgeDays =
    pairCreatedAt != null ? (Date.now() - pairCreatedAt) / (86_400_000) : null

  let marketCap: number | null = null
  if (dexPair?.marketCap != null && typeof dexPair.marketCap === 'number') {
    marketCap = dexPair.marketCap
  } else if (price != null && supply.ui != null && Number.isFinite(supply.ui)) {
    marketCap = price * supply.ui
  } else if (dexPair?.fdv != null && typeof dexPair.fdv === 'number') {
    marketCap = dexPair.fdv
  }

  const name =
    meta?.onChainMetadata?.metadata?.data?.name ||
    meta?.legacyMetadata?.name ||
    dexPair?.baseToken?.name ||
    'Unknown'
  const symbol =
    meta?.onChainMetadata?.metadata?.data?.symbol ||
    meta?.legacyMetadata?.symbol ||
    dexPair?.baseToken?.symbol ||
    '???'
  const imageUrl = parseImageUrl(meta)

  const baseMeta = {
    scannedAt,
    cacheAge: 0,
    scanId,
    keyTier,
    subscriptionTier: publicTier,
  }

  const [mintParsed, holderRows] = await Promise.all([fetchMintParsed(mint), fetchLargestHolders(mint)])

  const decimals = mintParsed?.decimals ?? 9
  const { holders, top10Concentration } = buildTopHolders(holderRows, supply.raw, decimals)

  const mintAuthority = mintParsed
    ? normalizeAuthField(mintParsed.mintAuthority)
    : normalizeAuthField(null)
  const freezeAuthority = mintParsed
    ? normalizeAuthField(mintParsed.freezeAuthority)
    : normalizeAuthField(null)
  const updateAuthority = parseUpdateAuthority(meta)

  const liquidityLock = bestEffortLiquidityLock(dexPair)
  const insiderFlags = null

  let riskScore: number | null = null
  let riskVerdict: TokenIntelligenceReport['riskVerdict'] = null
  let riskSignals: TokenIntelligenceReport['riskSignals'] = null

  if (keyTier === 'v2') {
    const lockedLongTerm = liquidityLock.lockUntil != null && liquidityLock.status === 'locked'
    const risk = computeRiskScoreAndSignals({
      mintAuthorityRenounced: mintAuthority.renounced,
      freezeAuthorityRenounced: freezeAuthority.renounced,
      updateAuthorityRenounced: updateAuthority != null ? updateAuthority.renounced : null,
      lpBurnedPct: liquidityLock.burnedPct,
      lockedLongTerm,
      top10Concentration,
      liquidityUsd,
      pairAgeDays,
      insiderFlags,
    })
    riskScore = risk.score
    riskVerdict = risk.verdict
    riskSignals = risk.signals
  }

  return {
    mint,
    name: String(name),
    symbol: String(symbol),
    imageUrl,
    decimals,
    supply,
    price,
    priceChange24h,
    marketCap,
    volume24h,
    liquidityUsd,
    pairAgeDays,
    mintAuthority: keyTier === 'v2' ? mintAuthority : undefined,
    freezeAuthority: keyTier === 'v2' ? freezeAuthority : undefined,
    updateAuthority: keyTier === 'v2' ? updateAuthority ?? undefined : undefined,
    topHolders: keyTier === 'v2' ? holders : undefined,
    top10Concentration: keyTier === 'v2' ? top10Concentration : undefined,
    liquidityLock: keyTier === 'v2' ? liquidityLock : undefined,
    insiderFlags,
    riskScore,
    riskVerdict,
    riskSignals,
    recentTxCount: txCount,
    meta: baseMeta,
  }
}
