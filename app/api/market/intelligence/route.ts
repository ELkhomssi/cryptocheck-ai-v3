/**
 * GET /api/market/intelligence
 * Aggregates public market quotes (BTC/ETH/SOL + Fear&Greed + Solana TPS).
 * ~200–800ms estimated (CoinGecko + F&G + optional RPC).
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type LiveMarketQuotes = {
  solUsd: number | null
  solChangePct: number | null
  btcUsd: number | null
  btcChangePct: number | null
  ethUsd: number | null
  ethChangePct: number | null
  fearGreed: number | null
  fearGreedLabel: string | null
  marketCapUsd: number | null
  marketCapChangePct: number | null
  tps: number | null
  activeWallets: number | null
  source: string
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function GET() {
  const t0 = Date.now()

  const [prices, global, fng] = await Promise.all([
    fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
    ),
    fetchJson<{
      data?: {
        total_market_cap?: { usd?: number }
        market_cap_change_percentage_24h_usd?: number
      }
    }>('https://api.coingecko.com/api/v3/global'),
    fetchJson<{ data?: Array<{ value?: string; value_classification?: string }> }>(
      'https://api.alternative.me/fng/?limit=1',
    ),
  ])

  let solUsd = prices?.solana?.usd ?? null
  const solChange = prices?.solana?.usd_24h_change ?? null
  if (solUsd == null) {
    const jup = await fetchJson<Record<string, { usdPrice?: number }>>(
      'https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112',
    )
    solUsd = jup?.So11111111111111111111111111111111111111112?.usdPrice ?? null
  }

  let tps: number | null = null
  try {
    const rpc =
      process.env.HELIUS_RPC_URL ||
      (process.env.HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
        : 'https://api.mainnet-beta.solana.com')
    const perf = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPerformanceSamples',
        params: [1],
      }),
      cache: 'no-store',
    })
    if (perf.ok) {
      const body = (await perf.json()) as {
        result?: Array<{ numTransactions?: number; samplePeriodSecs?: number }>
      }
      const sample = body.result?.[0]
      if (sample?.numTransactions && sample.samplePeriodSecs) {
        tps = sample.numTransactions / sample.samplePeriodSecs
      }
    }
  } catch {
    /* ignore */
  }

  const fngRow = fng?.data?.[0]
  const fearGreed = fngRow?.value != null ? Number(fngRow.value) : null

  const payload: LiveMarketQuotes & { latencyMs: number } = {
    solUsd,
    solChangePct: solChange != null ? Number(solChange) : null,
    btcUsd: prices?.bitcoin?.usd ?? null,
    btcChangePct: prices?.bitcoin?.usd_24h_change ?? null,
    ethUsd: prices?.ethereum?.usd ?? null,
    ethChangePct: prices?.ethereum?.usd_24h_change ?? null,
    fearGreed: Number.isFinite(fearGreed) ? fearGreed : null,
    fearGreedLabel: fngRow?.value_classification ?? null,
    marketCapUsd: global?.data?.total_market_cap?.usd ?? null,
    marketCapChangePct: global?.data?.market_cap_change_percentage_24h_usd ?? null,
    tps,
    activeWallets: null,
    source: 'coingecko+fng+rpc',
    latencyMs: Date.now() - t0,
  }

  return NextResponse.json(payload)
}
