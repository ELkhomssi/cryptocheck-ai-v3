import 'server-only'

import { PublicKey } from '@solana/web3.js'
import { PUBLIC_SOLANA_RPC_URL } from '@/lib/helius'
import { rpcCall } from '@/lib/helius-server'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'

type TokenAccountRow = {
  account: {
    data: {
      parsed: {
        info: {
          mint: string
          tokenAmount: { uiAmount: number | null; amount?: string; decimals: number }
        }
      }
    }
  }
}

/** Prefer Helius when `HELIUS_KEY` is set; otherwise public mainnet (read-only). */
async function solanaRpcForPortfolio<T>(method: string, params: unknown[]): Promise<T> {
  const key = process.env.HELIUS_KEY?.trim()
  if (key) {
    return rpcCall<T>(method, params)
  }
  const res = await fetch(PUBLIC_SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = (await res.json()) as { result?: T; error?: { message?: string } }
  if (data.error) throw new Error(data.error.message ?? 'Solana RPC error')
  if (!res.ok) throw new Error(`Solana RPC HTTP ${res.status}`)
  return data.result as T
}

function isValidWalletAddress(address: string): boolean {
  const t = address.trim()
  if (t.length < 32 || t.length > 44) return false
  try {
    new PublicKey(t)
    return true
  } catch {
    return false
  }
}

async function fetchDexScreenerPriceUsd(mint: string): Promise<number | null> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'CryptoCheckTradingOs/1.0 (portfolio-valuation)',
    },
  })
  if (!res.ok) return null
  const j = (await res.json()) as {
    pairs?: Array<{ chainId?: string; priceUsd?: number | string; liquidity?: { usd?: number } }>
  }
  const solanaPairs = (j.pairs ?? []).filter((p) => String(p.chainId ?? '').toLowerCase() === 'solana')
  const priced = solanaPairs
    .map((p) => {
      const px = typeof p.priceUsd === 'number' ? p.priceUsd : Number(p.priceUsd)
      return { px, liq: p.liquidity?.usd ?? 0 }
    })
    .filter((x) => Number.isFinite(x.px) && x.px > 0)
  if (!priced.length) return null
  priced.sort((a, b) => b.liq - a.liq)
  return priced[0]!.px
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    for (;;) {
      const idx = i++
      if (idx >= items.length) return
      out[idx] = await fn(items[idx]!)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return out
}

export type PortfolioValuationToken = {
  mint: string
  balance: number
  price: number | null
  value: number | null
}

export type PortfolioValuationResult = {
  total_value: number
  tokens: PortfolioValuationToken[]
}

/**
 * On-chain SPL balances + native SOL, priced in USD via DexScreener (best-effort per mint).
 */
export async function computeWalletPortfolioValuation(wallet: string): Promise<PortfolioValuationResult> {
  const w = wallet.trim()
  if (!isValidWalletAddress(w)) {
    throw new Error('INVALID_WALLET')
  }

  const balRaw = await solanaRpcForPortfolio<unknown>('getBalance', [w, { commitment: 'confirmed' }])
  const lamports =
    typeof balRaw === 'number'
      ? balRaw
      : balRaw && typeof balRaw === 'object' && 'value' in balRaw && typeof (balRaw as { value: unknown }).value === 'number'
        ? (balRaw as { value: number }).value
        : 0
  const nativeSol = lamports > 0 ? lamports / 1e9 : 0

  const tokenAccounts = await solanaRpcForPortfolio<{ value: TokenAccountRow[] }>('getTokenAccountsByOwner', [
    w,
    { programId: TOKEN_PROGRAM },
    { encoding: 'jsonParsed' },
  ])

  const byMint = new Map<string, number>()

  for (const row of tokenAccounts?.value ?? []) {
    const info = row.account?.data?.parsed?.info
    if (!info?.mint) continue
    const ui = info.tokenAmount?.uiAmount
    const amt =
      typeof ui === 'number' && Number.isFinite(ui)
        ? ui
        : info.tokenAmount?.amount != null && info.tokenAmount?.decimals != null
          ? Number(info.tokenAmount.amount) / 10 ** info.tokenAmount.decimals
          : 0
    if (!Number.isFinite(amt) || amt <= 0) continue
    byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + amt)
  }

  if (nativeSol > 0) {
    byMint.set(SOL_MINT, (byMint.get(SOL_MINT) ?? 0) + nativeSol)
  }

  const mints = Array.from(byMint.keys()).sort()
  const prices = await mapWithConcurrency(mints, 6, async (mint) => {
    const price = await fetchDexScreenerPriceUsd(mint)
    return { mint, price }
  })
  const priceMap = new Map(prices.map((p) => [p.mint, p.price]))

  const tokens: PortfolioValuationToken[] = mints.map((mint) => {
    const balance = byMint.get(mint) ?? 0
    const price = priceMap.get(mint) ?? null
    const value = price != null ? balance * price : null
    return { mint, balance, price, value }
  })

  tokens.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const total_value = tokens.reduce((s, t) => s + (t.value != null && Number.isFinite(t.value) ? t.value : 0), 0)

  return { total_value, tokens }
}

export { isValidWalletAddress }
