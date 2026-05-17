import 'server-only'

import { fetchTokenMetricsWithPair } from '@/lib/dexscreener/fetch-token-metrics'
import { getPulseFeed, type PulseEntry } from '@/lib/services/pulse-feed.service'
import { canonicalScan } from '@/lib/sentinel/canonical-scan'

const WSOL = 'So11111111111111111111111111111111111111112'

export const WEB4_DEFAULT_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' // BONK

export type Web4MarketSnapshot = {
  mint: string
  symbol: string
  name: string
  solUsd: number
  priceSol: number
  priceUsd: number
  change24h: number
  liquidity: number
  volume: number
  fdv: number
  source: string
  updatedAt: string
}

export type Web4SafeMemecoin = {
  id: string
  mint: string
  name: string
  ticker: string
  emoji: string
  gradient: string
  progress: number
  marketCap: number
  verdict: string
  safetyScore: number
}

export type Web4AuthorityState = 'revoked' | 'active' | 'unknown'

export type Web4NeuralSafety = {
  mint: string
  safetyPct: number
  verdict: string
  secure: boolean
  mintAuthority: Web4AuthorityState
  freezeAuthority: Web4AuthorityState
  updatedAt: string
}

function mapAuthority(state: 'renounced' | 'active' | 'unknown'): Web4AuthorityState {
  if (state === 'renounced') return 'revoked'
  return state
}

const CURATED_MEMECOINS: Array<{
  mint: string
  name: string
  ticker: string
  emoji: string
  gradient: string
}> = [
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    name: 'Bonk',
    ticker: 'BONK',
    emoji: '🐕',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    mint: 'EKpQGSml4jJeE3yJGk2bCRfFsGPNJMhTqHMLHJNK4p',
    name: 'dogwifhat',
    ticker: 'WIF',
    emoji: '🐕',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdCBuHYmW2hr',
    name: 'Popcat',
    ticker: 'POPCAT',
    emoji: '🐱',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
    name: 'Fartcoin',
    ticker: 'FARTC',
    emoji: '💨',
    gradient: 'from-cyan-500 to-emerald-500',
  },
  {
    mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    name: 'cat in a dogs world',
    ticker: 'MEW',
    emoji: '🐱',
    gradient: 'from-sky-500 to-indigo-500',
  },
]

export async function fetchSolUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      `https://price.jup.ag/v6/price?ids=${WSOL}`,
      { next: { revalidate: 30 } },
    )
    const data = (await res.json()) as {
      data?: Record<string, { price?: number }>
    }
    const price = data?.data?.[WSOL]?.price
    if (typeof price === 'number' && price > 0) return price
  } catch {
    /* fall through */
  }
  try {
    const cg = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 } },
    )
    const cgd = (await cg.json()) as { solana?: { usd?: number } }
    if (typeof cgd?.solana?.usd === 'number') return cgd.solana.usd
  } catch {
    /* fall through */
  }
  return 150
}

export async function getWeb4MarketSnapshot(mint: string): Promise<Web4MarketSnapshot> {
  const normalized = mint.trim() || WEB4_DEFAULT_MINT
  const [solUsd, metrics] = await Promise.all([
    fetchSolUsdPrice(),
    fetchTokenMetricsWithPair(normalized),
  ])

  const priceUsd = metrics.priceUsd ?? 0
  const priceSol = solUsd > 0 && priceUsd > 0 ? priceUsd / solUsd : 0.000042
  const symbol = metrics.pair?.baseToken?.symbol ?? 'TOKEN'
  const name = metrics.pair?.baseToken?.name ?? symbol

  return {
    mint: normalized,
    symbol,
    name,
    solUsd,
    priceSol: priceSol > 0 ? priceSol : 0.000042,
    priceUsd: priceUsd > 0 ? priceUsd : priceSol * solUsd,
    change24h: metrics.priceChange24h ?? 0,
    liquidity: metrics.liquidityUsd ?? 0,
    volume: metrics.volume24hUsd ?? 0,
    fdv: metrics.marketCapUsd ?? metrics.volume24hUsd ?? 0,
    source: metrics.pair ? 'dexscreener' : 'fallback',
    updatedAt: new Date().toISOString(),
  }
}

function bondingProgress(liquidityUsd: number, marketCapUsd: number): number {
  const liq = Math.max(0, liquidityUsd)
  const cap = Math.max(liq, marketCapUsd)
  const ratio = cap > 0 ? liq / cap : 0
  return Math.min(99.5, Math.max(12, Math.round(35 + ratio * 55 + (cap > 500_000 ? 15 : 0))))
}

export async function getWeb4SafeFeed(): Promise<Web4SafeMemecoin[]> {
  const pulse = await getPulseFeed()
  const pulseMints = new Map<string, PulseEntry>()
  for (const p of pulse) {
    if (p.mint.length >= 32) pulseMints.set(p.mint, p)
  }

  const seeds = CURATED_MEMECOINS.map((c) => {
    const pulseHit = [...pulseMints.values()].find((p) => p.mint === c.mint)
    return { ...c, pulse: pulseHit }
  })

  const rows = await Promise.all(
    seeds.map(async (seed) => {
      try {
        const metrics = await fetchTokenMetricsWithPair(seed.mint)
        const cap = metrics.marketCapUsd ?? metrics.liquidityUsd ?? 0
        const liq = metrics.liquidityUsd ?? 0
        const safetyScore = seed.pulse?.aggregateScore ?? 78
        const verdict = seed.pulse?.verdict ?? 'SAFE'
        return {
          id: seed.mint,
          mint: seed.mint,
          name: metrics.pair?.baseToken?.name ?? seed.name,
          ticker: (metrics.pair?.baseToken?.symbol ?? seed.ticker).toUpperCase().slice(0, 6),
          emoji: seed.emoji,
          gradient: seed.gradient,
          progress: bondingProgress(liq, cap),
          marketCap: cap,
          verdict,
          safetyScore,
        } satisfies Web4SafeMemecoin
      } catch {
        return {
          id: seed.mint,
          mint: seed.mint,
          name: seed.name,
          ticker: seed.ticker,
          emoji: seed.emoji,
          gradient: seed.gradient,
          progress: 68,
          marketCap: 420_000,
          verdict: seed.pulse?.verdict ?? 'CAUTION',
          safetyScore: seed.pulse?.aggregateScore ?? 72,
        } satisfies Web4SafeMemecoin
      }
    }),
  )

  return rows.sort((a, b) => b.safetyScore - a.safetyScore)
}

export async function getWeb4NeuralSafety(mint: string): Promise<Web4NeuralSafety> {
  const normalized = mint.trim() || WEB4_DEFAULT_MINT
  try {
    const scan = await canonicalScan(normalized)
    const mintAuth = scan.authorities?.mint ?? 'unknown'
    const freezeAuth = scan.authorities?.freeze ?? 'unknown'
    const revoked =
      mintAuth === 'renounced' &&
      (freezeAuth === 'renounced' || freezeAuth === 'unknown')
    return {
      mint: normalized,
      safetyPct: Math.max(0, Math.min(100, scan.riskScore)),
      verdict: scan.verdict,
      secure: scan.verdict === 'SAFE' && scan.riskScore >= 75,
      mintAuthority: mapAuthority(mintAuth),
      freezeAuthority: mapAuthority(freezeAuth),
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return {
      mint: normalized,
      safetyPct: 72,
      verdict: 'CAUTION',
      secure: false,
      mintAuthority: 'unknown',
      freezeAuthority: 'unknown',
      updatedAt: new Date().toISOString(),
    }
  }
}
