import {
  change24hPct,
  marketCapUsd,
  priceSol,
  progressPct,
  quoteSell,
  randomBotWallet,
  seedDefaultTokens,
  type BondingToken,
} from './pump-curve'
import type { Candle, Side, TokenCard, TradeRow } from './terminal-types'

export const USER_WALLET = '5jWw…x15i'
export const DEFAULT_SOL = 42

export const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtCompact = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${fmt(n, 0)}`
}

export const rand = (min: number, max: number) => min + Math.random() * (max - min)
export const uid = () => Math.random().toString(36).slice(2, 10)

export function ageLabel(createdAt: number): string {
  const s = Math.floor((Date.now() - createdAt) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function shortMint(mint: string) {
  return mint.length > 8 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : mint
}

export function tokenToCard(t: BondingToken, solUsd: number): TokenCard {
  const vol = t.volumeSol
  return {
    id: t.mint,
    mint: t.mint,
    name: t.name,
    ticker: t.ticker,
    emoji: t.emoji,
    gradient: t.gradient,
    progress: progressPct(t),
    marketCap: marketCapUsd(t, solUsd),
    change24h: change24hPct(t),
    volumeSol: vol,
    liquidityUsd: t.realSolRaised * solUsd * 1200,
    buys: Math.floor(vol * 12 + rand(50, 400)),
    sells: Math.floor(vol * 9 + rand(40, 350)),
    graduated: t.graduated,
    createdAt: t.createdAt,
    description: t.description,
    raw: t,
  }
}

export function generateCandles(count: number, basePrice: number): Candle[] {
  const out: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const o = price
    const move = rand(-0.08, 0.08) * price
    const c = Math.max(0.00001, o + move)
    const h = Math.max(o, c) + rand(0, 0.04) * price
    const l = Math.min(o, c) - rand(0, 0.04) * price
    out.push({ o, h, l, c })
    price = c
  }
  return out
}

export function formatClock(d = new Date()) {
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function pushCandle(candles: Candle[], price: number, side: Side, max = 56): Candle[] {
  const copy = candles.length ? [...candles] : [{ o: price, h: price, l: price, c: price }]
  const last = copy[copy.length - 1]
  const o = last.c
  const c = price
  const h = Math.max(o, c) * (1 + (side === 'buy' ? rand(0.002, 0.012) : rand(0.002, 0.01)))
  const l = Math.min(o, c) * (1 - rand(0.002, 0.01))
  return [...copy.slice(-(max - 1)), { o, h, l, c }]
}

export function tokensForSolOut(token: BondingToken, solWanted: number, maxHeld: number): number {
  if (solWanted <= 0 || maxHeld <= 0) return 0
  let lo = 0
  let hi = maxHeld
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    if (quoteSell(token, mid) < solWanted) lo = mid
    else hi = mid
  }
  return Math.min(maxHeld, hi)
}

export function makeTradeRow(side: Side, price: number, amount: number, wallet: string): TradeRow {
  return {
    id: uid(),
    price,
    amount,
    total: price * amount,
    side,
    depth: rand(0.35, 1),
    wallet,
    time: formatClock(),
    age: '0s',
  }
}

type Boot = {
  tokens: Record<string, BondingToken>
  firstMint: string
  candles: Candle[]
}

let bootCache: Boot | undefined

export function bootTerminal(): Boot {
  if (bootCache) return bootCache
  const tokens = seedDefaultTokens()
  const firstMint = Object.keys(tokens)[0]!
  const p = priceSol(tokens[firstMint]!)
  bootCache = { tokens, firstMint, candles: generateCandles(48, p) }
  return bootCache
}
