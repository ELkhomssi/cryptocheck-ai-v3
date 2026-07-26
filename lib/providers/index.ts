import 'server-only'

/**
 * Phase 10.1 — provider client barrel.
 * All modules are server-only; do not import from client components.
 */

export type {
  TokenPrice,
  TokenMarketMetrics,
  ScreenerRow,
  OhlcvPoint,
  NewPool,
} from '@/lib/providers/types'

export { fetchPrices, getQuote } from '@/lib/providers/jupiter'
export type { JupiterQuote, JupiterQuoteOptions } from '@/lib/providers/jupiter'

export {
  rpc,
  getAssetsByOwner,
  getParsedTokenAccounts,
  getAsset,
  heliusAssetMeta,
} from '@/lib/providers/helius'
export type { HeliusDasAsset, ParsedTokenAccount } from '@/lib/providers/helius'

export {
  fetchTokenOverview,
  fetchTokenMarket,
  fetchTrending,
  fetchTokenList,
  fetchOhlcv,
  fetchNewListings,
  fetchPriceChange,
} from '@/lib/providers/birdeye'
export type { TokenListParams, PriceChangeWindows } from '@/lib/providers/birdeye'

export { fetchNewPools, fetchPoolByMint } from '@/lib/providers/raydium'

export { fetchTokenPairs, fetchTokenMetricsFromDex, fetchDexScreenerSolanaMints, fetchDexScreenerScreenerRows } from '@/lib/providers/dexscreener'

export {
  acquireProviderQuota,
  pauseProvider,
  withProviderQuota,
  mapBatched,
  chunkArray,
  getProviderUsage,
  getAllProviderUsage,
  getProviderQuotaConfig,
  ProviderQuotaError,
} from '@/lib/providers/quota'
export type { ProviderId, QuotaDecision, QuotaUsage } from '@/lib/providers/quota'

export { providerFetch, providerFetchJson } from '@/lib/providers/http'

export { cachedJson, cacheGetJson, cacheSetJson } from '@/lib/cache/ttl'
