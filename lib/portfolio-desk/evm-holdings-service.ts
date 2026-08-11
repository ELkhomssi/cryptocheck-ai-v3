/**
 * EVM holdings — real RPC native balance + Ethplorer ERC-20 (Ethereum mainnet).
 * Pricing via DexScreener (native fetch). No new HTTP client libraries.
 */

import 'server-only'

import type { Holding, HoldingsResponse } from '@/types/portfolio-desk'

export type EvmHoldingsChain = 'ethereum' | 'base' | 'bnb' | 'arbitrum'

const DUST_USD = 0.5
const EVM_ADDR = /^0x[a-fA-F0-9]{40}$/

const NATIVE: Record<
  EvmHoldingsChain,
  { symbol: string; name: string; decimals: number; coingeckoId: string; wrapped?: string }
> = {
  ethereum: {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    coingeckoId: 'ethereum',
    wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  base: {
    symbol: 'ETH',
    name: 'Ether (Base)',
    decimals: 18,
    coingeckoId: 'ethereum',
    wrapped: '0x4200000000000000000000000000000000000006',
  },
  bnb: {
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    coingeckoId: 'binancecoin',
    wrapped: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  },
  arbitrum: {
    symbol: 'ETH',
    name: 'Ether (Arbitrum)',
    decimals: 18,
    coingeckoId: 'ethereum',
    wrapped: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
}

const RPC_DEFAULTS: Record<EvmHoldingsChain, string> = {
  ethereum: process.env.ETH_RPC_URL?.trim() || 'https://ethereum.publicnode.com',
  base: process.env.BASE_RPC_URL?.trim() || 'https://base.publicnode.com',
  bnb: process.env.BNB_RPC_URL?.trim() || 'https://bsc.publicnode.com',
  arbitrum: process.env.ARBITRUM_RPC_URL?.trim() || 'https://arbitrum.publicnode.com',
}

export function isValidEvmWallet(wallet: string | null | undefined): boolean {
  return Boolean(wallet && EVM_ADDR.test(wallet.trim()))
}

export function parseEvmHoldingsChain(raw: string | null | undefined): EvmHoldingsChain {
  const c = String(raw ?? 'ethereum').toLowerCase().trim()
  if (c === 'base') return 'base'
  if (c === 'bnb' || c === 'bsc') return 'bnb'
  if (c === 'arbitrum' || c === 'arb') return 'arbitrum'
  return 'ethereum'
}

async function rpcCall(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`RPC ${res.status}`)
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error?.message) throw new Error(body.error.message)
  return body.result
}

async function fetchNativeBalance(rpcUrl: string, wallet: string): Promise<number> {
  const hex = (await rpcCall(rpcUrl, 'eth_getBalance', [wallet, 'latest'])) as string
  if (!hex || typeof hex !== 'string') return 0
  const wei = BigInt(hex)
  return Number(wei) / 1e18
}

type EthplorerToken = {
  tokenInfo?: { address?: string; symbol?: string; name?: string; decimals?: string | number; image?: string }
  balance?: number
  rawBalance?: string
}

async function fetchEthplorerTokens(wallet: string): Promise<
  Array<{ address: string; symbol: string; name: string; amount: number; decimals: number; logoUrl: string | null }>
> {
  const key = process.env.ETHPLORER_API_KEY?.trim() || 'freekey'
  const res = await fetch(
    `https://api.ethplorer.io/getAddressInfo/${wallet}?apiKey=${encodeURIComponent(key)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return []
  const body = (await res.json().catch(() => null)) as {
    tokens?: EthplorerToken[]
    error?: { message?: string }
  } | null
  if (!body || body.error) return []
  const out: Array<{
    address: string
    symbol: string
    name: string
    amount: number
    decimals: number
    logoUrl: string | null
  }> = []
  for (const t of body.tokens ?? []) {
    const address = t.tokenInfo?.address
    if (!address || !EVM_ADDR.test(address)) continue
    const decimals = Number(t.tokenInfo?.decimals ?? 18)
    const raw = t.rawBalance != null ? Number(t.rawBalance) : Number(t.balance ?? 0)
    if (!Number.isFinite(raw) || raw <= 0) continue
    const amount = decimals >= 0 ? raw / 10 ** Math.min(decimals, 18) : raw
    if (!Number.isFinite(amount) || amount <= 0) continue
    out.push({
      address,
      symbol: (t.tokenInfo?.symbol || address.slice(0, 6)).slice(0, 12),
      name: t.tokenInfo?.name || t.tokenInfo?.symbol || 'Token',
      amount,
      decimals: Number.isFinite(decimals) ? decimals : 18,
      logoUrl: t.tokenInfo?.image ? `https://ethplorer.io${t.tokenInfo.image}` : null,
    })
  }
  return out.slice(0, 40)
}

async function fetchDexPrices(addresses: string[]): Promise<
  Map<string, { priceUsd: number; change24hPct: number | null; logoUrl?: string; symbol?: string; name?: string }>
> {
  const map = new Map<
    string,
    { priceUsd: number; change24hPct: number | null; logoUrl?: string; symbol?: string; name?: string }
  >()
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()).filter((a) => EVM_ADDR.test(a)))]
  // DexScreener accepts comma-separated batches (cap ~30)
  for (let i = 0; i < unique.length; i += 25) {
    const batch = unique.slice(i, i + 25)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`, {
        cache: 'no-store',
      })
      if (!res.ok) continue
      const body = (await res.json()) as {
        pairs?: Array<{
          baseToken?: { address?: string; symbol?: string; name?: string }
          priceUsd?: string
          priceChange?: { h24?: number }
          info?: { imageUrl?: string }
          liquidity?: { usd?: number }
        }>
      }
      const best = new Map<string, { liq: number; row: (typeof body.pairs)[0] }>()
      for (const p of body.pairs ?? []) {
        const addr = p.baseToken?.address?.toLowerCase()
        if (!addr) continue
        const liq = p.liquidity?.usd ?? 0
        const prev = best.get(addr)
        if (!prev || liq > prev.liq) best.set(addr, { liq, row: p })
      }
      for (const [addr, { row }] of best) {
        const priceUsd = Number(row.priceUsd ?? 0)
        if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue
        map.set(addr, {
          priceUsd,
          change24hPct:
            typeof row.priceChange?.h24 === 'number' && Number.isFinite(row.priceChange.h24)
              ? row.priceChange.h24
              : null,
          logoUrl: row.info?.imageUrl,
          symbol: row.baseToken?.symbol,
          name: row.baseToken?.name,
        })
      }
    } catch {
      /* continue */
    }
  }
  return map
}

async function fetchNativeUsd(coingeckoId: string): Promise<{ priceUsd: number; change24hPct: number | null }> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd&include_24hr_change=true`,
      { cache: 'no-store' },
    )
    if (!res.ok) return { priceUsd: 0, change24hPct: null }
    const body = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>
    const row = body[coingeckoId]
    const priceUsd = typeof row?.usd === 'number' ? row.usd : 0
    const change24hPct =
      typeof row?.usd_24h_change === 'number' && Number.isFinite(row.usd_24h_change)
        ? row.usd_24h_change
        : null
    return { priceUsd, change24hPct }
  } catch {
    return { priceUsd: 0, change24hPct: null }
  }
}

export async function buildEvmHoldingsResponse(
  walletAddress: string,
  chain: EvmHoldingsChain = 'ethereum',
): Promise<HoldingsResponse> {
  const wallet = walletAddress.trim()
  if (!isValidEvmWallet(wallet)) throw new Error('Invalid EVM wallet address')

  const meta = NATIVE[chain]
  const rpc = RPC_DEFAULTS[chain]
  const nativeAmount = await fetchNativeBalance(rpc, wallet).catch(() => 0)
  const nativePx = await fetchNativeUsd(meta.coingeckoId)

  const tokenRows =
    chain === 'ethereum' ? await fetchEthplorerTokens(wallet).catch(() => []) : []

  const priceMap = await fetchDexPrices([
    ...(meta.wrapped ? [meta.wrapped] : []),
    ...tokenRows.map((t) => t.address),
  ])

  // Prefer CoinGecko for native; wrapped Dex price as fallback
  let nativePrice = nativePx.priceUsd
  let nativeChg = nativePx.change24hPct
  if ((!nativePrice || nativePrice <= 0) && meta.wrapped) {
    const w = priceMap.get(meta.wrapped.toLowerCase())
    if (w) {
      nativePrice = w.priceUsd
      nativeChg = w.change24hPct
    }
  }

  const holdings: Holding[] = []

  if (nativeAmount > 0) {
    const valueUsd = nativeAmount * (nativePrice || 0)
    holdings.push({
      mint: `native:${chain}`,
      symbol: meta.symbol,
      name: meta.name,
      logoUrl: null,
      amount: nativeAmount,
      valueUsd,
      priceUsd: nativePrice || 0,
      change24hPct: nativeChg,
      avgBuyPriceUsd: null,
      allocationPct: 0,
      decimals: meta.decimals,
      chain,
    })
  }

  for (const t of tokenRows) {
    const px = priceMap.get(t.address.toLowerCase())
    const priceUsd = px?.priceUsd ?? 0
    const valueUsd = t.amount * priceUsd
    if (valueUsd < DUST_USD && priceUsd > 0) continue
    if (priceUsd <= 0) continue // honest: skip unpriced dust rather than invent USD
    holdings.push({
      mint: t.address,
      symbol: px?.symbol || t.symbol,
      name: px?.name || t.name,
      logoUrl: px?.logoUrl || t.logoUrl,
      amount: t.amount,
      valueUsd,
      priceUsd,
      change24hPct: px?.change24hPct ?? null,
      avgBuyPriceUsd: null,
      allocationPct: 0,
      decimals: t.decimals,
      chain: 'ethereum',
    })
  }

  const totalValueUsd = holdings.reduce((s, h) => s + h.valueUsd, 0)
  for (const h of holdings) {
    h.allocationPct = totalValueUsd > 0 ? (h.valueUsd / totalValueUsd) * 100 : 0
  }
  holdings.sort((a, b) => b.valueUsd - a.valueUsd)

  const native = holdings.find((h) => h.mint.startsWith('native:'))

  return {
    walletAddress: wallet,
    totalValueUsd,
    holdings,
    availableSol: 0,
    availableSolUsd: 0,
    availableNative: native?.amount ?? 0,
    availableNativeUsd: native?.valueUsd ?? 0,
    nativeSymbol: meta.symbol,
    chainFamily: 'evm',
    chain,
    fetchedAt: new Date().toISOString(),
  }
}
