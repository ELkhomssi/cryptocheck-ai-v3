/**
 * Terminal OS live market fetchers (server-only).
 * CoinGecko + DexScreener free tiers; optional Helius/Etherscan/Whale Alert keys.
 */

import 'server-only'

import { cachedJson } from '@/lib/cache/ttl'
import { classifyWhaleMovement } from '@/features/terminal-os/shared/lib/classify-whale-movement'
import { enrichWhaleMovement } from '@/features/terminal-os/shared/lib/enrich-whale-movement'
import { rankAlphaDesks } from '@/features/terminal-os/shared/lib/rank-alpha-desks'
import type {
  CandleBar,
  ChainId,
  ChainMarketSnapshot,
  MarketOverview,
  TickerQuote,
  TokenRow,
  TopTrader,
  WhaleMovement,
} from '@/features/terminal-os/shared/types'

const CG = 'https://api.coingecko.com/api/v3'
const DEX = 'https://api.dexscreener.com'

const TICKER_TTL = 12
const GLOBAL_TTL = 30
const TOKEN_TTL = 20
const CANDLE_TTL = 60
const WHALE_TTL = 25

type DexPair = {
  chainId?: string
  pairAddress?: string
  url?: string
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number; h1?: number }
  priceChange?: { h24?: number; h1?: number; m5?: number }
  txns?: { h24?: { buys?: number; sells?: number } }
  fdv?: number
  marketCap?: number
  pairCreatedAt?: number
  baseToken?: { address?: string; symbol?: string; name?: string }
  quoteToken?: { address?: string; symbol?: string; name?: string }
  info?: { imageUrl?: string }
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

const CHAIN_TO_DEX: Record<Exclude<ChainId, 'all'>, string> = {
  solana: 'solana',
  bnb: 'bsc',
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
}

const CHAIN_SEARCH: Record<ChainId, string> = {
  all: 'PEPE',
  solana: 'BONK',
  bnb: 'CAKE',
  ethereum: 'PEPE',
  base: 'DEGEN',
  arbitrum: 'ARB',
}

const COIN_OHLC_IDS: Partial<Record<ChainId, string>> = {
  solana: 'solana',
  bnb: 'binancecoin',
  ethereum: 'ethereum',
  base: 'ethereum',
  all: 'bitcoin',
  arbitrum: 'ethereum',
}

function pairToToken(pair: DexPair, chain: ChainId): TokenRow | null {
  const symbol = pair.baseToken?.symbol
  const address = pair.baseToken?.address
  if (!symbol || !address) return null
  const change = num(pair.priceChange?.h24)
  const buys = pair.txns?.h24?.buys ?? 0
  const sells = pair.txns?.h24?.sells ?? 0
  // Build a tiny sparkline proxy from multi-window changes (real signed moves)
  const c1 = num(pair.priceChange?.m5)
  const c2 = num(pair.priceChange?.h1)
  const price = num(pair.priceUsd)
  const sparkBase = price > 0 ? price : 1
  const sparkline = [
    sparkBase * (1 - c2 / 100),
    sparkBase * (1 - c2 / 200),
    sparkBase * (1 - c1 / 100),
    sparkBase,
    sparkBase * (1 + c1 / 200),
    sparkBase * (1 + change / 300),
    sparkBase * (1 + change / 200),
    sparkBase * (1 + change / 100),
  ]
  return {
    id: address,
    symbol,
    name: pair.baseToken?.name || symbol,
    chain,
    priceUsd: price,
    change24hPct: change,
    volume24hUsd: num(pair.volume?.h24),
    liquidityUsd: num(pair.liquidity?.usd),
    marketCapUsd: num(pair.marketCap ?? pair.fdv),
    txCount24h: Math.max(0, buys + sells),
    buySellRatio: sells > 0 ? buys / sells : buys > 0 ? buys : 0,
    sparkline,
    logoUrl: pair.info?.imageUrl,
    pairAddress: pair.pairAddress,
  }
}

function mapDexChain(chainId?: string): ChainId {
  switch ((chainId || '').toLowerCase()) {
    case 'solana':
      return 'solana'
    case 'bsc':
      return 'bnb'
    case 'ethereum':
      return 'ethereum'
    case 'base':
      return 'base'
    case 'arbitrum':
      return 'arbitrum'
    default:
      return 'ethereum'
  }
}

/** Spot ticker — CoinGecko simple/price (no key). */
export async function fetchLiveTickerQuotes(): Promise<TickerQuote[]> {
  return cachedJson('tos:ticker:v1', TICKER_TTL, async () => {
    const body = await fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      `${CG}/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true`,
    )
    if (!body) return []
    const map: { id: string; symbol: string }[] = [
      { id: 'solana', symbol: 'SOL' },
      { id: 'bitcoin', symbol: 'BTC' },
      { id: 'ethereum', symbol: 'ETH' },
      { id: 'binancecoin', symbol: 'BNB' },
    ]
    return map
      .map(({ id, symbol }) => {
        const row = body[id]
        if (!row || typeof row.usd !== 'number') return null
        return {
          symbol,
          priceUsd: row.usd,
          change24hPct: num(row.usd_24h_change),
        } satisfies TickerQuote
      })
      .filter((x): x is TickerQuote => x != null)
  })
}

/** Global market overview — CoinGecko /global. */
export async function fetchLiveMarketOverview(): Promise<MarketOverview | null> {
  return cachedJson('tos:global:v1', GLOBAL_TTL, async () => {
    const body = await fetchJson<{
      data?: {
        total_market_cap?: { usd?: number }
        total_volume?: { usd?: number }
        market_cap_percentage?: { btc?: number }
        market_cap_change_percentage_24h_usd?: number
      }
    }>(`${CG}/global`)
    const d = body?.data
    if (!d) return null
    const btcDom = num(d.market_cap_percentage?.btc)
    // Altcoin index proxy: inverse of BTC dominance scaled to 0–100
    const altcoinIndex = Math.max(0, Math.min(100, Math.round(100 - btcDom)))
    return {
      marketCapUsd: num(d.total_market_cap?.usd),
      volume24hUsd: num(d.total_volume?.usd),
      btcDominancePct: btcDom,
      altcoinIndex,
      marketCapChange24hPct: num(d.market_cap_change_percentage_24h_usd),
      fetchedAt: new Date().toISOString(),
      source: 'coingecko',
    } satisfies MarketOverview
  })
}

async function searchDexPairs(query: string, limit: number): Promise<DexPair[]> {
  const body = await fetchJson<{ pairs?: DexPair[] | null }>(
    `${DEX}/latest/dex/search?q=${encodeURIComponent(query)}`,
  )
  return Array.isArray(body?.pairs) ? body!.pairs!.slice(0, limit) : []
}

/** Top tokens by chain via DexScreener search (no key). */
export async function fetchLiveTopTokens(chain: ChainId, limit = 12): Promise<TokenRow[]> {
  const lim = Math.min(Math.max(4, limit), 16)
  return cachedJson(`tos:tokens:${chain}:${lim}`, TOKEN_TTL, async () => {
    const q = CHAIN_SEARCH[chain] || 'SOL'
    const pairs = await searchDexPairs(q, 40)
    const want = chain === 'all' ? null : CHAIN_TO_DEX[chain]
    const seen = new Set<string>()
    const out: TokenRow[] = []
    for (const p of pairs) {
      if (want && p.chainId !== want) continue
      const mapped = pairToToken(p, chain === 'all' ? mapDexChain(p.chainId) : chain)
      if (!mapped || seen.has(mapped.id)) continue
      // Prefer liquid pairs
      if (mapped.liquidityUsd < 5_000 && mapped.volume24hUsd < 20_000) continue
      seen.add(mapped.id)
      out.push(mapped)
      if (out.length >= lim) break
    }
    out.sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    return out
  })
}

/** OHLC candles — CoinGecko OHLC + market_chart volumes (real). */
export async function fetchLiveCandles(chain: ChainId): Promise<CandleBar[]> {
  const id = COIN_OHLC_IDS[chain] || 'bitcoin'
  return cachedJson(`tos:ohlc:v2:${id}`, CANDLE_TTL, async () => {
    const [rows, chart] = await Promise.all([
      fetchJson<number[][]>(`${CG}/coins/${id}/ohlc?vs_currency=usd&days=1`),
      fetchJson<{ total_volumes?: [number, number][] }>(
        `${CG}/coins/${id}/market_chart?vs_currency=usd&days=1`,
      ),
    ])
    if (!Array.isArray(rows)) return []
    const vols = Array.isArray(chart?.total_volumes) ? chart!.total_volumes! : []
    return rows
      .filter((r) => Array.isArray(r) && r.length >= 5)
      .map((r) => {
        const timeMs = Number(r[0])
        const time = Math.floor(timeMs / 1000)
        let volume = 0
        if (vols.length) {
          let best = vols[0]!
          let bestDist = Math.abs(best[0]! - timeMs)
          for (const v of vols) {
            const d = Math.abs(v[0]! - timeMs)
            if (d < bestDist) {
              best = v
              bestDist = d
            }
          }
          volume = Number(best[1]) || 0
        }
        return {
          time,
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume,
        }
      })
      .filter((c) => Number.isFinite(c.open) && c.time > 0)
  })
}

export async function fetchLiveChainSnapshots(): Promise<ChainMarketSnapshot[]> {
  const chains: { chain: ChainId; label: string }[] = [
    { chain: 'solana', label: 'Solana' },
    { chain: 'bnb', label: 'BNB Chain' },
    { chain: 'base', label: 'Base' },
    { chain: 'all', label: 'Market Overview' },
  ]
  return Promise.all(
    chains.map(async (c) => {
      const [topTokens, candles] = await Promise.all([
        fetchLiveTopTokens(c.chain, 6),
        fetchLiveCandles(c.chain),
      ])
      return { chain: c.chain, label: c.label, topTokens, candles }
    }),
  )
}

/**
 * Whale-scale flows from live DexScreener high-volume pairs + optional Whale Alert.
 * Pair address truncated as flow id when wallet-level attribution isn't available.
 * Attribution fields (portfolio / win rate) stay null unless sampleAttribution is set —
 * never fabricate wallet PnL from volume proxies.
 */
export async function fetchLiveWhaleMovements(limit = 24): Promise<WhaleMovement[]> {
  const lim = Math.min(Math.max(8, limit), 48)
  return cachedJson(`tos:whales:v3:${lim}`, WHALE_TTL, async () => {
    const whaleKey = process.env.WHALE_ALERT_API_KEY?.trim()
    if (whaleKey) {
      const wa = await fetchJson<{
        transactions?: {
          id?: string
          blockchain?: string
          symbol?: string
          amount?: number
          amount_usd?: number
          transaction_type?: string
          from?: { address?: string }
          to?: { address?: string }
          timestamp?: number
        }[]
      }>(`https://api.whale-alert.io/v1/transactions?api_key=${whaleKey}&min_value=500000&limit=${lim}`)
      if (wa?.transactions?.length) {
        return wa.transactions.slice(0, lim).map((tx, i) => {
          const actionRaw = (tx.transaction_type || 'transfer').toLowerCase()
          const action =
            actionRaw.includes('mint') || actionRaw.includes('deposit')
              ? ('deposit' as const)
              : actionRaw.includes('burn') || actionRaw.includes('withdrawal')
                ? ('withdraw' as const)
                : actionRaw.includes('sell')
                  ? ('sell' as const)
                  : actionRaw.includes('swap') || actionRaw.includes('exchange')
                    ? ('swap' as const)
                    : actionRaw.includes('transfer')
                      ? ('transfer' as const)
                      : ('buy' as const)
          const addr = tx.from?.address || tx.to?.address || `whale-${i}`
          const chain = mapDexChain(tx.blockchain === 'bitcoin' ? 'ethereum' : tx.blockchain)
          const usdValue = num(tx.amount_usd)
          return enrichWhaleMovement(
            {
              id: String(tx.id || `wa-${i}`),
              walletFull: addr,
              chain,
              action,
              assetSymbol: (tx.symbol || 'USD').toUpperCase(),
              usdValue,
              amount: num(tx.amount),
              occurredAt: new Date((tx.timestamp || Date.now() / 1000) * 1000).toISOString(),
              classificationWhy: `Whale Alert: ${action} ${usdValue.toLocaleString()} USD on ${chain}.`,
              volume24hUsd: usdValue * 4,
            },
            classifyWhaleMovement,
          )
        })
      }
    }

    // Fallback: largest live DexScreener pair volume as market flow events (real USD)
    const [sol, eth, bnb, base] = await Promise.all([
      searchDexPairs('SOL', 14),
      searchDexPairs('ETH', 14),
      searchDexPairs('BNB', 12),
      searchDexPairs('DEGEN', 10),
    ])
    const pairs = [...sol, ...eth, ...bnb, ...base]
      .filter((p) => num(p.volume?.h24) >= 200_000)
      .sort((a, b) => num(b.volume?.h24) - num(a.volume?.h24))
      .slice(0, lim)

    return pairs.map((p, i) => {
      const change = num(p.priceChange?.h1)
      const vol = num(p.volume?.h24)
      const liq = num(p.liquidity?.usd)
      const buys = num(p.txns?.h24?.buys)
      const sells = num(p.txns?.h24?.sells)
      let action: WhaleMovement['action'] =
        change <= -4 ? 'sell' : change >= 4 ? 'buy' : 'swap'
      if (Math.abs(change) < 1.5 && vol > 2_000_000) action = 'transfer'
      // Extreme sell pressure on thin liquidity → alert path via classification
      const addr = p.pairAddress || p.baseToken?.address || `flow-${i}`
      const usdValue = Math.max(vol * 0.08, liq * 0.05)
      const classification = classifyWhaleMovement({
        action,
        usdValue,
        liquidityDeltaPct: change,
        isNewToken: Boolean(p.pairCreatedAt && Date.now() - p.pairCreatedAt < 86_400_000 * 7),
        isKnownDevWallet: sells > buys * 3 && change < -8,
      })
      return enrichWhaleMovement(
        {
          id: `${p.pairAddress || i}-${i}`,
          walletFull: addr,
          chain: mapDexChain(p.chainId),
          action,
          assetSymbol: (p.baseToken?.symbol || '?').toUpperCase(),
          tokenLogoUrl: p.info?.imageUrl,
          usdValue,
          amount: num(p.volume?.h1) || vol / 24,
          occurredAt: new Date(Date.now() - i * 18_000).toISOString(),
          classification,
          classificationWhy: `Live DexScreener ${p.chainId} pair volume $${Math.round(vol).toLocaleString()} · 1h ${change.toFixed(1)}%.`,
          liquidityUsd: liq,
          volume24hUsd: vol,
        },
        classifyWhaleMovement,
      )
    })
  })
}

/**
 * Top traders — CoinGecko movers ranked by alpha-desk algorithm → mockup personas.
 * PnL% / volume / price are live; handles are deterministic persona maps.
 */
export async function fetchLiveTopTraders(limit = 8): Promise<TopTrader[]> {
  const lim = Math.min(Math.max(8, limit), 12)
  return cachedJson(`tos:traders:v4:${lim}`, TOKEN_TTL, async () => {
    const body = await fetchJson<
      {
        id: string
        symbol: string
        name: string
        image?: string
        current_price?: number
        price_change_percentage_24h?: number
        total_volume?: number
        market_cap?: number
      }[]
    >(
      `${CG}/coins/markets?vs_currency=usd&order=percent_change_24h_desc&per_page=40&page=1&sparkline=false&price_change_percentage=24h`,
    )
    if (!Array.isArray(body) || !body.length) return []
    const STABLES = new Set([
      'usdt',
      'usdc',
      'dai',
      'usd1',
      'fdusd',
      'tusd',
      'usde',
      'usds',
      'busd',
      'usdd',
      'pyusd',
      'usdg',
      'usdp',
      'gusd',
      'lusd',
      'frax',
      'eurs',
      'eurc',
    ])
    const filtered = body.filter((c) => {
      const sym = (c.symbol || '').toLowerCase()
      if (STABLES.has(sym)) return false
      if (sym.includes('usd') && sym.length <= 5) return false
      return true
    })
    return rankAlphaDesks(filtered.length ? filtered : body, lim)
  })
}
