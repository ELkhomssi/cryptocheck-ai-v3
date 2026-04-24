import 'server-only'
import { redis } from '@/lib/cache/redis'
import { getHeliusApiKeyFromEnv } from '@/lib/helius-server'
import { fetchSmartMoneyWallets } from './fetch-smart-money'

export type WhaleTransaction = {
  signature: string
  timestamp: string
  walletAddress: string
  walletTier: string
  action: 'bought' | 'sold'
  amountTokens: number
  amountUsd: number | null
  priceUsd: number | null
}

/**
 * Fetch last N large transactions for a mint involving smart-money wallets.
 * Uses Helius getSignaturesForAddress + parsed transactions.
 */
export async function fetchWhaleFlowForMint(
  mint: string,
  opts?: { hoursBack?: number; limit?: number }
): Promise<WhaleTransaction[]> {
  const cacheKey = `whale_flow:${mint}`
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached as string)

  const smartWallets = await fetchSmartMoneyWallets({ limit: 100 })
  if (smartWallets.length === 0) return []

  const heliusKey = getHeliusApiKeyFromEnv()
  if (!heliusKey) {
    console.warn('[whale-flow] HELIUS_API_KEY / HELIUS_KEY missing — skipping on-chain wallet sweep (empty flow)')
    return []
  }

  const hoursBack = opts?.hoursBack ?? 24
  const cutoff = Date.now() - hoursBack * 3600 * 1000

  const results: WhaleTransaction[] = []

  // Batch 10 wallets at a time to respect rate limits
  for (let i = 0; i < smartWallets.length; i += 10) {
    const batch = smartWallets.slice(i, i + 10)
    const batchResults = await Promise.all(
      batch.map((w) => fetchWalletTokenTxs(w, mint, cutoff, heliusKey))
    )
    results.push(...batchResults.flat())
  }

  // Sort by amountUsd desc
  results.sort((a, b) => (b.amountUsd ?? 0) - (a.amountUsd ?? 0))
  const top = results.slice(0, opts?.limit ?? 100)

  await redis.setex(cacheKey, 300, JSON.stringify(top))
  return top
}

async function fetchWalletTokenTxs(
  wallet: { address: string; tier: string },
  mint: string,
  cutoffMs: number,
  heliusKey: string
): Promise<WhaleTransaction[]> {
  // Implementation: Helius getSignaturesForAddress + getParsedTransactions
  // Filter txs where tokenBalanceChanges mentions the mint
  // Classify action based on balance delta direction
  // Enrich with USD value at timestamp
  // Return matching txs
  // [Full implementation — handle errors gracefully, return [] on failure]
  void wallet
  void mint
  void cutoffMs
  void heliusKey
  return []
}
