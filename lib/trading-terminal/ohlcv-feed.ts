/**
 * OHLCV datafeed — DemoAdapter (DEMO_SEED) + LiveAdapter (GeckoTerminal via DexScreener pair).
 * Chart UI reads only Candle[] — never hardcodes series in JSX.
 */

export type Candle = {
  time: number // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type OhlcvResult =
  | { status: 'ready'; candles: Candle[]; lastPrice: number; changePct: number; source: 'demo' | 'live' }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string }
  | { status: 'building'; reason: string }

export type OhlcvRequest = {
  mint: string
  symbol: string
  timeframe: '1m' | '5m' | '15m' | '1H' | '4H' | '1D'
}

function tfToGecko(tf: OhlcvRequest['timeframe']): { resolution: string; aggregate: number } {
  if (tf === '1m') return { resolution: 'minute', aggregate: 1 }
  if (tf === '5m') return { resolution: 'minute', aggregate: 5 }
  if (tf === '15m') return { resolution: 'minute', aggregate: 15 }
  if (tf === '1H') return { resolution: 'hour', aggregate: 1 }
  if (tf === '4H') return { resolution: 'hour', aggregate: 4 }
  return { resolution: 'day', aggregate: 1 }
}

/** Summarize series for chart header (last + session change vs first open). */
export function summarizeCandles(candles: Candle[]): { lastPrice: number; changePct: number } {
  if (!candles.length) return { lastPrice: 0, changePct: 0 }
  const last = candles[candles.length - 1]!
  const first = candles[0]!
  const changePct = first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0
  return { lastPrice: last.close, changePct }
}

/** Map DEMO_SEED candle rows → Candle[] (unix seconds). */
export function mapDemoSeedCandles(
  rows: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>,
): Candle[] {
  return rows.map((c) => ({
    time: Math.floor(c.t / 1000),
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v,
  }))
}

/** Live: DexScreener pair → GeckoTerminal OHLCV. ~200–800ms. */
export async function fetchLiveOhlcv(req: OhlcvRequest): Promise<OhlcvResult> {
  if (req.mint.length < 32 || req.mint.startsWith('Demo')) {
    return { status: 'unavailable', reason: 'No live pair for this symbol.' }
  }
  try {
    const ds = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${req.mint}`, {
      cache: 'no-store',
    })
    if (!ds.ok) {
      return { status: 'unavailable', reason: 'Price feed offline.' }
    }
    const body = (await ds.json()) as {
      pairs?: Array<{ pairAddress?: string; chainId?: string; priceUsd?: string }>
    }
    const pair = (body.pairs || []).find((p) => p.chainId === 'solana' && p.pairAddress)
    if (!pair?.pairAddress) {
      return { status: 'building', reason: 'Building history…' }
    }

    const { resolution, aggregate } = tfToGecko(req.timeframe)
    const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pair.pairAddress}/ohlcv/${resolution}?aggregate=${aggregate}&limit=120`
    const gt = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!gt.ok) {
      // Fallback: synthesize sparse candles from last price only — honest "building"
      return { status: 'building', reason: 'Building history…' }
    }
    const gtBody = (await gt.json()) as {
      data?: { attributes?: { ohlcv_list?: number[][] } }
    }
    const list = gtBody.data?.attributes?.ohlcv_list
    if (!list?.length) {
      return { status: 'building', reason: 'Building history…' }
    }
    // Gecko returns [ts, o, h, l, c, v] newest-first sometimes — normalize
    const candles: Candle[] = list
      .map((row) => ({
        time: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5] ?? 0),
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time)

    if (candles.length < 3) {
      return { status: 'building', reason: 'Building history…' }
    }
    const { lastPrice, changePct } = summarizeCandles(candles)
    return { status: 'ready', candles, lastPrice, changePct, source: 'live' }
  } catch {
    return { status: 'unavailable', reason: 'Chart feed offline.' }
  }
}
