/**
 * Phase 17.2 — Market Analyst narrative (presentation only).
 * Derives human conclusions from existing ScreenerRow + LiveMarketQuotes fields.
 * Never invents prices, volumes, or provider facts. If inputs are empty → honest gap.
 */

import type { ScreenerRow, TokenMarketMetrics } from '@/lib/providers/types'

/** Subset of GET /api/market/intelligence — presentation only. */
export type MarketMacroQuotes = {
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
  source?: string
}

export type MarketNarrativeId =
  | 'ai'
  | 'infrastructure'
  | 'memecoins'
  | 'defi'
  | 'rwa'

export type MarketInsightCard = {
  id: string
  /** Human conclusion — never a raw metric label. */
  conclusion: string
  whyItMatters: string
  confidence: 'low' | 'medium' | 'high'
  evidence: MarketEvidence
}

export type MarketEvidence = {
  metrics: Array<{ label: string; value: string }>
  movers: Array<{
    symbol: string
    mint: string
    change24hPct: number
    volume24hUsd: number
    note: string
  }>
  spark: number[]
  unavailableReason: string | null
}

export type NarrativeCluster = {
  id: MarketNarrativeId
  title: string
  conclusion: string
  liquidityMove: string
  why: string
  confidence: 'low' | 'medium' | 'high'
  risk: string
  shortTerm: string
  evidence: MarketEvidence
  tokenCount: number
}

export type MarketAnalystBrief = {
  /** First-screen hero — what the market is doing. */
  conclusion: string
  whyItMatters: string
  attention: string | null
  insightCards: MarketInsightCard[]
  narratives: NarrativeCluster[]
  /** Aggregate sample for charts section (not first screen). */
  sampleSpark: number[]
  sourcesNote: string
  unavailableReason: string | null
  fetchedHint: string | null
}

const NARRATIVE_META: Record<
  MarketNarrativeId,
  { title: string; keywords: string[] }
> = {
  ai: {
    title: 'AI',
    keywords: ['ai', 'gpt', 'llm', 'agent', 'neural', 'compute', 'intel', 'brain'],
  },
  infrastructure: {
    title: 'Infrastructure',
    keywords: ['rpc', 'infra', 'oracle', 'node', 'validator', 'data', 'bridge', 'l2', 'network'],
  },
  memecoins: {
    title: 'Memecoins',
    keywords: ['pepe', 'doge', 'bonk', 'wif', 'meme', 'cat', 'dog', 'trump', 'popcat', 'moodeng'],
  },
  defi: {
    title: 'DeFi',
    keywords: ['swap', 'lend', 'yield', 'amm', 'dex', 'perp', 'stake', 'vault', 'finance', 'usd'],
  },
  rwa: {
    title: 'RWA',
    keywords: ['rwa', 'treasury', 'gold', 'estate', 'bond', 'tbill', 't-bill', 'realworld'],
  },
}

const UNAVAILABLE = 'Not enough real market data available yet.'

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function confidenceFromSample(n: number, avgAbsChg: number): 'low' | 'medium' | 'high' {
  if (n < 3) return 'low'
  if (n >= 8 && avgAbsChg >= 2) return 'high'
  if (n >= 5) return 'medium'
  return 'low'
}

function textBlob(row: TokenMarketMetrics): string {
  return `${row.symbol ?? ''} ${row.name ?? ''}`.toLowerCase()
}

function classifyRow(row: ScreenerRow): MarketNarrativeId | null {
  const blob = textBlob(row)
  for (const id of Object.keys(NARRATIVE_META) as MarketNarrativeId[]) {
    if (NARRATIVE_META[id].keywords.some((k) => blob.includes(k))) return id
  }
  // Structural fallback from existing flags — still real attributes, not invented categories.
  if (row.isPumpFun) return 'memecoins'
  if (row.isRaydium && row.liquidityUsd >= 250_000 && row.volume24hUsd >= 100_000) return 'defi'
  return null
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

function emptyEvidence(reason = UNAVAILABLE): MarketEvidence {
  return { metrics: [], movers: [], spark: [], unavailableReason: reason }
}

function moversFrom(rows: ScreenerRow[], limit = 4): MarketEvidence['movers'] {
  return [...rows]
    .sort((a, b) => Math.abs(b.change24hPct) - Math.abs(a.change24hPct))
    .slice(0, limit)
    .map((r) => ({
      symbol: r.symbol || r.mint.slice(0, 4),
      mint: r.mint,
      change24hPct: r.change24hPct,
      volume24hUsd: r.volume24hUsd,
      note:
        r.smartMoneyScore >= 60
          ? 'Elevated smart-money score in live sample'
          : r.buySellRatio >= 1.15
            ? 'Buy-side ratio elevated in live sample'
            : r.buySellRatio > 0 && r.buySellRatio < 0.85
              ? 'Sell-side pressure in live sample'
              : 'Live sample move',
    }))
}

function evidenceFromRows(rows: ScreenerRow[]): MarketEvidence {
  if (!rows.length) return emptyEvidence()
  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const vols = rows.map((r) => r.volume24hUsd).filter((n) => Number.isFinite(n) && n > 0)
  const liqs = rows.map((r) => r.liquidityUsd).filter((n) => Number.isFinite(n) && n > 0)
  const buys = rows.map((r) => r.buySellRatio).filter((n) => Number.isFinite(n) && n > 0)
  const smart = rows
    .map((r) => r.smartMoneyScore)
    .filter((n) => Number.isFinite(n))
  const aChg = avg(chgs)
  const aVol = avg(vols)
  const aLiq = avg(liqs)
  const aBuy = avg(buys)
  const aSmart = avg(smart)
  return {
    metrics: [
      aChg != null ? { label: 'Sample 24h avg', value: fmtPct(aChg) } : null,
      aVol != null ? { label: 'Sample avg volume', value: fmtUsd(aVol) } : null,
      aLiq != null ? { label: 'Sample avg liquidity', value: fmtUsd(aLiq) } : null,
      aBuy != null ? { label: 'Avg buy/sell ratio', value: aBuy.toFixed(2) } : null,
      aSmart != null ? { label: 'Avg smart-money score', value: aSmart.toFixed(0) } : null,
      { label: 'Tokens in sample', value: String(rows.length) },
    ].filter(Boolean) as Array<{ label: string; value: string }>,
    movers: moversFrom(rows),
    spark: chgs.slice(0, 12),
    unavailableReason: null,
  }
}

function pressureInsight(rows: ScreenerRow[]): MarketInsightCard | null {
  if (rows.length < 3) return null
  const buys = rows.map((r) => r.buySellRatio).filter((n) => Number.isFinite(n) && n > 0)
  const smart = rows.map((r) => r.smartMoneyScore).filter((n) => Number.isFinite(n))
  const vols = rows.map((r) => r.volume24hUsd).filter((n) => n > 0)
  const aBuy = avg(buys)
  const aSmart = avg(smart)
  const aVol = avg(vols)
  if (aBuy == null && aSmart == null) return null

  let conclusion: string
  let why: string
  if (aBuy != null && aBuy >= 1.12 && (aSmart == null || aSmart < 55)) {
    conclusion =
      'Buying pressure increased in the live sample, leaning toward newer flow rather than concentrated smart-money accumulation.'
    why =
      'Average buy/sell ratio is elevated while smart-money scores stay moderate — attention without a clear institutional stamp.'
  } else if (aBuy != null && aBuy >= 1.12 && aSmart != null && aSmart >= 55) {
    conclusion =
      'Buying pressure rose with elevated smart-money scores — accumulation looks more structured than pure retail chase.'
    why =
      'Both buy/sell ratio and smart-money scores sit above the mid range in the same live sample.'
  } else if (aBuy != null && aBuy < 0.9) {
    conclusion =
      'Selling pressure is more visible than demand in today’s live sample.'
    why =
      'Average buy/sell ratio sits below parity across the tokens we can measure.'
  } else {
    conclusion =
      'Order flow looks balanced — neither aggressive bid nor dump dominates the sample.'
    why = 'Buy/sell ratios cluster near parity across measured tokens.'
  }

  return {
    id: 'flow',
    conclusion,
    whyItMatters: why,
    confidence: confidenceFromSample(rows.length, Math.abs(aBuy ?? 1 - 1) * 10),
    evidence: evidenceFromRows(rows),
  }
}

function tapeInsight(rows: ScreenerRow[]): MarketInsightCard | null {
  if (!rows.length) return null
  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const a = avg(chgs)
  if (a == null) return null
  const top = [...rows].sort((x, y) => Math.abs(y.change24hPct) - Math.abs(x.change24hPct))[0]
  let conclusion: string
  if (a > 2) {
    conclusion = 'The Solana sample tape is strengthening — breadth of positive 24h moves outweighs declines.'
  } else if (a < -2) {
    conclusion = 'The Solana sample tape turned defensive — declines outweigh advances in the live set.'
  } else {
    conclusion = 'The Solana sample tape remains orderly — moves exist, but the aggregate stay measured.'
  }
  const why =
    top?.symbol != null
      ? `Largest absolute move in sample: ${top.symbol} at ${fmtPct(top.change24hPct)}.`
      : 'Aggregate is computed from the live screener sample only.'
  return {
    id: 'tape',
    conclusion,
    whyItMatters: why,
    confidence: confidenceFromSample(rows.length, Math.abs(a)),
    evidence: evidenceFromRows(rows),
  }
}

function macroInsight(q: MarketMacroQuotes | null): MarketInsightCard[] {
  if (!q) return []
  const cards: MarketInsightCard[] = []

  if (q.btcChangePct != null && Number.isFinite(q.btcChangePct)) {
    const btc = q.btcChangePct
    const sol = q.solChangePct
    let conclusion: string
    if (btc > 1 && (sol == null || sol < btc - 0.5)) {
      conclusion = 'Bitcoin continues absorbing relative strength versus Solana in today’s quotes.'
    } else if (sol != null && sol > btc + 1) {
      conclusion = 'Solana is outperforming Bitcoin on the day — alt liquidity is not fully rotating into BTC.'
    } else if (btc < -1 && sol != null && sol <= btc) {
      conclusion = 'Risk assets are softening together — Bitcoin is not offering a clean hedge in this window.'
    } else {
      conclusion = 'Bitcoin’s day move is present, but it is not dominating the Solana tape alone.'
    }
    cards.push({
      id: 'btc',
      conclusion,
      whyItMatters:
        sol != null
          ? 'Relative BTC vs SOL 24h change frames whether liquidity is concentrating or rotating.'
          : 'BTC 24h change is available; SOL change was not returned in this quote set.',
      confidence: sol != null ? 'medium' : 'low',
      evidence: {
        metrics: [
          { label: 'BTC 24h', value: fmtPct(btc) },
          sol != null ? { label: 'SOL 24h', value: fmtPct(sol) } : null,
          q.btcUsd != null ? { label: 'BTC USD', value: fmtUsd(q.btcUsd) } : null,
          q.solUsd != null ? { label: 'SOL USD', value: fmtUsd(q.solUsd) } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        movers: [],
        spark: [btc, sol ?? 0].filter((n) => Number.isFinite(n)),
        unavailableReason: null,
      },
    })
  }

  if (q.fearGreed != null && Number.isFinite(q.fearGreed)) {
    const v = q.fearGreed
    const label = q.fearGreedLabel || ''
    let conclusion: string
    if (v >= 65) {
      conclusion =
        'Market optimism remains elevated, though stretched readings often accompany thinner caution.'
    } else if (v >= 45) {
      conclusion =
        'Market optimism remains positive but confidence has weakened versus classic greed readings.'
    } else if (v >= 30) {
      conclusion = 'Sentiment sits in a cautious band — participants are hedging enthusiasm.'
    } else {
      conclusion = 'Fear dominates the sentiment print — capital is defensive in the macro read.'
    }
    cards.push({
      id: 'sentiment',
      conclusion,
      whyItMatters: label
        ? `Fear & Greed classifies this print as “${label}”.`
        : 'Fear & Greed index is available from the existing intelligence feed.',
      confidence: 'medium',
      evidence: {
        metrics: [
          { label: 'Fear & Greed', value: String(Math.round(v)) },
          label ? { label: 'Classification', value: label } : null,
          q.marketCapChangePct != null
            ? { label: 'Global mcap 24h', value: fmtPct(q.marketCapChangePct) }
            : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        movers: [],
        spark: [v],
        unavailableReason: null,
      },
    })
  }

  if (q.marketCapChangePct != null && Number.isFinite(q.marketCapChangePct)) {
    const m = q.marketCapChangePct
    cards.push({
      id: 'mcap',
      conclusion:
        m > 1
          ? 'Global crypto market cap expanded — liquidity is entering the complex, not only rotating inside it.'
          : m < -1
            ? 'Global crypto market cap contracted — pressure is broader than a single chain story.'
            : 'Global market cap is roughly flat — today’s drama is more rotation than net inflow.',
      whyItMatters: 'Macro market-cap change frames whether Solana moves are idiosyncratic or systemic.',
      confidence: 'medium',
      evidence: {
        metrics: [
          { label: 'Global mcap 24h', value: fmtPct(m) },
          q.marketCapUsd != null ? { label: 'Global mcap', value: fmtUsd(q.marketCapUsd) } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        movers: [],
        spark: [m],
        unavailableReason: null,
      },
    })
  }

  return cards
}

function buildNarrative(
  id: MarketNarrativeId,
  rows: ScreenerRow[],
): NarrativeCluster {
  const title = NARRATIVE_META[id].title
  if (rows.length === 0) {
    return {
      id,
      title,
      conclusion: UNAVAILABLE,
      liquidityMove: UNAVAILABLE,
      why: 'No tokens in the live sample matched this narrative with enough evidence.',
      confidence: 'low',
      risk: 'Unknown — sample empty.',
      shortTerm: UNAVAILABLE,
      evidence: emptyEvidence(),
      tokenCount: 0,
    }
  }

  const chgs = rows.map((r) => r.change24hPct)
  const aChg = avg(chgs) ?? 0
  const aVol = avg(rows.map((r) => r.volume24hUsd)) ?? 0
  const aLiq = avg(rows.map((r) => r.liquidityUsd)) ?? 0
  const aRisk = avg(rows.map((r) => r.riskScore)) ?? 50
  const aSmart = avg(rows.map((r) => r.smartMoneyScore)) ?? 0
  const aBuy = avg(rows.map((r) => r.buySellRatio).filter((n) => n > 0))
  const top = [...rows].sort((a, b) => b.volume24hUsd - a.volume24hUsd)[0]!

  let conclusion: string
  if (aChg > 3) {
    conclusion = `${title} names in the live sample are advancing — volume is following the move higher.`
  } else if (aChg < -3) {
    conclusion = `${title} names are under pressure — liquidity is leaving this cluster in the sample.`
  } else {
    conclusion = `${title} looks rotational rather than directional — price action is mixed inside the cluster.`
  }

  const liquidityMove =
    aVol > aLiq * 0.35
      ? `Turnover is elevated versus resting liquidity (sample avg volume ${fmtUsd(aVol)} vs liquidity ${fmtUsd(aLiq)}).`
      : `Liquidity still cushions turnover in this cluster (sample avg liquidity ${fmtUsd(aLiq)}).`

  const why =
    aBuy != null && aBuy >= 1.1
      ? `Buy/sell ratio averages ${aBuy.toFixed(2)}; ${top.symbol || 'top name'} leads volume.`
      : aBuy != null && aBuy < 0.9
        ? `Sell-leaning flow (avg ratio ${aBuy.toFixed(2)}); ${top.symbol || 'top name'} anchors volume.`
        : `${top.symbol || 'Lead name'} carries the volume print at ${fmtUsd(top.volume24hUsd)}.`

  const risk =
    aRisk >= 65
      ? 'Elevated risk scores dominate this cluster — treat strength as fragile.'
      : aRisk >= 40
        ? 'Risk scores are mixed — dispersion matters more than the headline.'
        : 'Risk scores sit lower in-sample — still not a guarantee of stability.'

  const shortTerm =
    aChg > 2 && aSmart >= 50
      ? 'Short-term bias: continued attention if smart-money scores hold.'
      : aChg < -2
        ? 'Short-term bias: further digestion until sell pressure cools in the sample.'
        : 'Short-term bias: range-bound until a clearer volume leader emerges.'

  return {
    id,
    title,
    conclusion,
    liquidityMove,
    why,
    confidence: confidenceFromSample(rows.length, Math.abs(aChg)),
    risk,
    shortTerm,
    evidence: evidenceFromRows(rows),
    tokenCount: rows.length,
  }
}

export type MarketAnalystInput = {
  screenerRows: ScreenerRow[]
  quotes: MarketMacroQuotes | null
  available?: boolean
  source?: string | null
}

/**
 * Build the analyst brief from existing market payloads only.
 */
export function buildMarketAnalystBrief(input: MarketAnalystInput): MarketAnalystBrief {
  const rows = (input.screenerRows ?? []).filter((r) => r.mint && r.mint.length >= 32)
  const sourcesNote = 'Birdeye · Jupiter · Helius · Raydium · CoinGecko / Fear&Greed (existing routes)'

  if (!rows.length && !input.quotes) {
    return {
      conclusion: UNAVAILABLE,
      whyItMatters: 'Market Intelligence needs a live screener or macro quote sample before it can speak.',
      attention: null,
      insightCards: [],
      narratives: (Object.keys(NARRATIVE_META) as MarketNarrativeId[]).map((id) =>
        buildNarrative(id, []),
      ),
      sampleSpark: [],
      sourcesNote,
      unavailableReason: UNAVAILABLE,
      fetchedHint: input.source ?? null,
    }
  }

  const insightCards: MarketInsightCard[] = []
  const tape = tapeInsight(rows)
  if (tape) insightCards.push(tape)
  const flow = pressureInsight(rows)
  if (flow) insightCards.push(flow)
  insightCards.push(...macroInsight(input.quotes))

  const byNarrative: Record<MarketNarrativeId, ScreenerRow[]> = {
    ai: [],
    infrastructure: [],
    memecoins: [],
    defi: [],
    rwa: [],
  }
  for (const row of rows) {
    const id = classifyRow(row)
    if (id) byNarrative[id].push(row)
  }
  const narratives = (Object.keys(NARRATIVE_META) as MarketNarrativeId[]).map((id) =>
    buildNarrative(id, byNarrative[id]),
  )

  const chgs = rows.map((r) => r.change24hPct).filter((n) => Number.isFinite(n))
  const aChg = avg(chgs)
  let conclusion: string
  let whyItMatters: string
  if (aChg == null && insightCards[0]) {
    conclusion = insightCards[0].conclusion
    whyItMatters = insightCards[0].whyItMatters
  } else if (aChg == null) {
    conclusion = UNAVAILABLE
    whyItMatters = 'Macro quotes may be present, but the Solana screener sample is empty.'
  } else if (aChg > 2) {
    conclusion = 'Solana markets are strengthening across the live sample.'
    whyItMatters =
      'Aggregate 24h change in the screener sample is firmly positive — attention should focus on where volume confirms the move.'
  } else if (aChg < -2) {
    conclusion = 'Solana markets turned defensive across the live sample.'
    whyItMatters =
      'Aggregate 24h change is negative — watch liquidity exits inside narratives before chasing dips.'
  } else {
    conclusion = 'Solana markets look orderly — rotation matters more than direction today.'
    whyItMatters =
      'Aggregate sample change is muted; narrative clusters and flow scores decide what deserves attention.'
  }

  const hotNarrative = [...narratives]
    .filter((n) => n.tokenCount > 0 && n.evidence.unavailableReason == null)
    .sort((a, b) => {
      const aa = avg(a.evidence.spark) ?? 0
      const bb = avg(b.evidence.spark) ?? 0
      return Math.abs(bb) - Math.abs(aa)
    })[0]

  const attention =
    hotNarrative && hotNarrative.tokenCount > 0
      ? `${hotNarrative.title} deserves attention: ${hotNarrative.conclusion}`
      : flow
        ? flow.conclusion
        : null

  return {
    conclusion,
    whyItMatters,
    attention,
    insightCards,
    narratives,
    sampleSpark: chgs.slice(0, 16),
    sourcesNote,
    unavailableReason: rows.length === 0 && insightCards.length === 0 ? UNAVAILABLE : null,
    fetchedHint: input.source ?? null,
  }
}

export function isMarketAnalystUnavailable(brief: MarketAnalystBrief): boolean {
  return Boolean(brief.unavailableReason) && brief.insightCards.length === 0
}
