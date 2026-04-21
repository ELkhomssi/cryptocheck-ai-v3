import 'server-only'

import type { TokenMeta } from '@/lib/helius'
import { heliusRest, rpcCall } from '@/lib/helius-server'

export type WalletHolding = {
  mint: string
  amount: number
  decimals: number
  symbol?: string
  name?: string
  logoUri?: string
  valueUsd?: number
}

type DexPair = {
  priceUsd?: string
}

type DexTokenResponse = {
  pairs?: DexPair[] | null
}

type TokenAccountResponse = {
  value: Array<{
    account?: {
      data?: {
        parsed?: {
          info?: {
            mint?: string
            tokenAmount?: {
              uiAmount?: number | null
              decimals?: number
            }
          }
        }
      }
    }
  }>
}

const HOLDINGS_CACHE_TTL_MS = 60_000
const walletHoldingsCache = new Map<string, { expiresAt: number; holdings: WalletHolding[] }>()

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function fetchDexPriceUsd(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const j = (await res.json()) as DexTokenResponse
    const raw = j.pairs?.[0]?.priceUsd
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function fetchTokenMetadataMap(mints: string[]): Promise<Record<string, TokenMeta>> {
  const map: Record<string, TokenMeta> = {}
  const mintChunks = chunk(mints, 100)
  for (const list of mintChunks) {
    try {
      const arr = await heliusRest<TokenMeta[]>('/token-metadata', { mintAccounts: list })
      for (const meta of arr ?? []) {
        if (meta?.account) map[meta.account] = meta
      }
    } catch {
      // metadata enrichment is best-effort
    }
  }
  return map
}

/**
 * Fetches all SPL token holdings for a given Solana wallet address.
 * Returns top N holdings by USD value (requires DexScreener enrichment).
 */
export async function fetchWalletHoldings(
  walletAddress: string,
  options?: { maxTokens?: number }
): Promise<WalletHolding[]> {
  const maxTokens = Math.max(1, Math.min(200, options?.maxTokens ?? 50))
  const cacheKey = `${walletAddress}:${maxTokens}`
  const now = Date.now()
  const cached = walletHoldingsCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.holdings

  const tokenAccounts = await rpcCall<TokenAccountResponse>('getTokenAccountsByOwner', [
    walletAddress,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ])

  const rawHoldings = (tokenAccounts?.value ?? [])
    .map((row) => row.account?.data?.parsed?.info)
    .filter(Boolean)
    .map((info) => ({
      mint: String(info?.mint ?? ''),
      amount: Number(info?.tokenAmount?.uiAmount ?? 0),
      decimals: Number(info?.tokenAmount?.decimals ?? 0),
    }))
    .filter((h) => h.mint.length > 0 && Number.isFinite(h.amount) && h.amount >= 1)

  if (rawHoldings.length === 0) {
    walletHoldingsCache.set(cacheKey, { expiresAt: now + HOLDINGS_CACHE_TTL_MS, holdings: [] })
    return []
  }

  const uniqueMints = Array.from(new Set(rawHoldings.map((h) => h.mint)))
  const [metaMap, prices] = await Promise.all([
    fetchTokenMetadataMap(uniqueMints),
    Promise.all(uniqueMints.map(async (mint) => [mint, await fetchDexPriceUsd(mint)] as const)),
  ])
  const priceMap: Record<string, number | null> = {}
  for (const [mint, price] of prices) priceMap[mint] = price

  const holdings = rawHoldings
    .map((h) => {
      const meta = metaMap[h.mint]
      const name =
        meta?.onChainMetadata?.metadata?.data?.name?.trim() ||
        meta?.legacyMetadata?.name?.trim() ||
        undefined
      const symbol =
        meta?.onChainMetadata?.metadata?.data?.symbol?.trim() ||
        meta?.legacyMetadata?.symbol?.trim() ||
        undefined
      const logoUri = meta?.onChainMetadata?.metadata?.data?.uri || undefined
      const priceUsd = priceMap[h.mint]
      const valueUsd = priceUsd != null ? priceUsd * h.amount : 0
      return { ...h, name, symbol, logoUri, valueUsd }
    })
    .sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0))
    .slice(0, maxTokens)

  walletHoldingsCache.set(cacheKey, { expiresAt: now + HOLDINGS_CACHE_TTL_MS, holdings })
  return holdings
}
