import 'server-only'

import { rpcCall } from '@/lib/helius-server'

const WSOL = 'So11111111111111111111111111111111111111112'

export type LpMovementAlertContext = {
  priceChange?: number
  devWallet?: string
  totalLiquidity?: number
  holderConcentration?: number
}

function pickPrimaryMintFromTx(tx: unknown): string | null {
  const t = tx as {
    meta?: {
      postTokenBalances?: Array<{ mint?: string }>
      preTokenBalances?: Array<{ mint?: string }>
    }
  }
  const post = t.meta?.postTokenBalances ?? []
  const pre = t.meta?.preTokenBalances ?? []
  const mints = [...new Set([...post, ...pre].map((b) => b.mint).filter(Boolean) as string[])]
  if (!mints.length) return null
  const nonSol = mints.filter((m) => m !== WSOL)
  return nonSol[0] ?? mints[0] ?? null
}

function pickFeePayerFromTx(tx: unknown): string | null {
  const t = tx as {
    transaction?: {
      message?: {
        accountKeys?: Array<string | { pubkey?: string }>
      }
    }
  }
  const keys = t.transaction?.message?.accountKeys
  if (!keys?.length) return null
  const k0 = keys[0]
  return typeof k0 === 'string' ? k0 : k0?.pubkey ?? null
}

async function dexScreenerTopSolanaPair(mint: string): Promise<{
  priceChangeH24: number | null
  liquidityUsd: number | null
}> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CryptoCheckTradingOs/1.0 (lp-alert-context)',
    },
  })
  if (!res.ok) return { priceChangeH24: null, liquidityUsd: null }
  const j = (await res.json()) as {
    pairs?: Array<{ chainId?: string; priceChange?: { h24?: number }; liquidity?: { usd?: number } }>
  }
  const sol = (j.pairs ?? []).filter((p) => String(p.chainId ?? '').toLowerCase() === 'solana')
  sol.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
  const top = sol[0]
  const pc = top?.priceChange?.h24
  const liq = top?.liquidity?.usd
  return {
    priceChangeH24: typeof pc === 'number' && Number.isFinite(pc) ? pc : null,
    liquidityUsd: typeof liq === 'number' && Number.isFinite(liq) ? liq : null,
  }
}

async function holderTop1Pct(mint: string): Promise<number | null> {
  try {
    const supply = await rpcCall<{ value?: { amount?: string } }>('getTokenSupply', [mint])
    const holders = await rpcCall<{ value?: Array<{ amount: string }> }>('getTokenLargestAccounts', [mint])
    const totalRaw = supply?.value?.amount ?? '0'
    const total = BigInt(totalRaw || '0')
    const top0 = holders?.value?.[0]?.amount
    if (total <= 0n || top0 == null) return null
    const top = BigInt(top0)
    return Number((top * 10000n) / total) / 100
  } catch {
    return null
  }
}

/**
 * Best-effort Helius/Solana RPC + DexScreener context for an LP-related signature.
 */
export async function buildLpAlertContextFromSignature(signature: string): Promise<LpMovementAlertContext> {
  const sig = signature.trim()
  if (sig.length < 64) return {}

  try {
    const tx = await rpcCall<unknown>('getTransaction', [
      sig,
      { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' },
    ])
    if (!tx) return {}

    const mint = pickPrimaryMintFromTx(tx)
    const devWallet = pickFeePayerFromTx(tx) ?? undefined

    let priceChange: number | undefined
    let totalLiquidity: number | undefined
    let holderConcentration: number | undefined

    if (mint) {
      const dex = await dexScreenerTopSolanaPair(mint)
      if (dex.priceChangeH24 != null) priceChange = dex.priceChangeH24
      if (dex.liquidityUsd != null) totalLiquidity = dex.liquidityUsd

      const top1 = await holderTop1Pct(mint)
      if (top1 != null) holderConcentration = top1
    }

    return {
      priceChange,
      devWallet,
      totalLiquidity,
      holderConcentration,
    }
  } catch {
    return {}
  }
}
