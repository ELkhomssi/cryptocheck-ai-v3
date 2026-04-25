import 'server-only'

import { rpcCall } from '@/lib/helius-server'
import type { LiquidityLockInfo } from '@/lib/types/intelligence'

export type DexPairLike = {
  dexId?: string
  pairAddress?: string
}

type Holder = {
  address: string
  amount: string
}

const KNOWN_BURN_ADDRESSES = new Set<string>([
  '1nc1nerator11111111111111111111111111111111',
  'HWzXGcGHy4tcpYfaRDCyLNzXqBTv3E6BttpCH2vJxArv',
])

const KNOWN_TIMELOCK_VAULTS = new Set<string>([
  // Extend as more vault programs are verified.
  'Es9vMFrzaCERx1f6VwBEmc6kAMPxQ4vYXvyfZ7Z84qxd',
])

type LockResult = LiquidityLockInfo & { reason: string }

function withReason(info: LiquidityLockInfo, reason: string): LockResult {
  return { ...info, reason }
}

function pct(amount: bigint, total: bigint): number {
  if (total <= 0n) return 0
  return Number((amount * 10000n) / total) / 100
}

function firstString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

async function resolveLpMint(pairAddress: string): Promise<string | null> {
  try {
    const res = await rpcCall<{
      value: {
        data?: {
          parsed?: { info?: Record<string, unknown> }
        }
      } | null
    }>('getAccountInfo', [pairAddress, { encoding: 'jsonParsed' }])
    const info = res?.value?.data?.parsed?.info
    if (!info || typeof info !== 'object') return null
    return firstString(info, ['lpMint', 'lp_mint', 'poolMint', 'poolTokenMint'])
  } catch {
    return null
  }
}

async function fetchSupplyRaw(mint: string): Promise<bigint | null> {
  try {
    const res = await rpcCall<{ value: { amount: string } }>('getTokenSupply', [mint])
    const amount = res?.value?.amount
    if (!amount) return null
    return BigInt(amount)
  } catch {
    return null
  }
}

async function fetchLargestAccounts(mint: string): Promise<Holder[]> {
  try {
    const res = await rpcCall<{ value: Array<{ address: string; amount: string }> }>('getTokenLargestAccounts', [mint])
    return Array.isArray(res?.value) ? res.value : []
  } catch {
    return []
  }
}

export async function detectLiquidityLock(pair: DexPairLike | null): Promise<LockResult> {
  if (!pair?.pairAddress) {
    return withReason(
      { status: 'unknown', burnedPct: null, lockUntil: null },
      'No DEX pair address found for this mint.'
    )
  }

  const lpMint = await resolveLpMint(pair.pairAddress)
  if (!lpMint) {
    return withReason(
      { status: 'unknown', burnedPct: null, lockUntil: null },
      `LP mint unavailable for ${pair.dexId ?? 'pool'} pair ${pair.pairAddress.slice(0, 8)}...`
    )
  }

  const [supplyRaw, holders] = await Promise.all([fetchSupplyRaw(lpMint), fetchLargestAccounts(lpMint)])
  if (!supplyRaw || supplyRaw <= 0n) {
    return withReason(
      { status: 'unknown', burnedPct: null, lockUntil: null },
      `LP supply unavailable for LP mint ${lpMint.slice(0, 8)}...`
    )
  }

  let burned = 0n
  let topHolder: Holder | null = null
  for (const holder of holders) {
    if (!topHolder) topHolder = holder
    try {
      const amount = BigInt(holder.amount || '0')
      if (KNOWN_BURN_ADDRESSES.has(holder.address)) burned += amount
    } catch {
      // ignore malformed holder amount
    }
  }

  const burnedPct = pct(burned, supplyRaw)
  if (burnedPct >= 99) {
    return withReason(
      { status: 'burned', burnedPct, lockUntil: null },
      `LP tokens are burned (${burnedPct.toFixed(2)}%) to known burn addresses.`
    )
  }

  if (topHolder?.address && KNOWN_TIMELOCK_VAULTS.has(topHolder.address)) {
    return withReason(
      { status: 'locked', burnedPct, lockUntil: null },
      `Largest LP holder is a verified timelock vault (${topHolder.address.slice(0, 8)}...).`
    )
  }

  if (topHolder?.address) {
    return withReason(
      { status: 'unlocked', burnedPct, lockUntil: null },
      `Largest LP holder ${topHolder.address.slice(0, 8)}... can move liquidity.`
    )
  }

  return withReason(
    { status: 'unknown', burnedPct, lockUntil: null },
    'No LP holder data returned from RPC.'
  )
}
